from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import login, logout, authenticate
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt # Importar para deshabilitar CSRF en API (solo para desarrollo)
import json # Para parsear el cuerpo de las peticiones POST/PUT
from .models import Mesa

# Vistas de autenticación y dashboard
def login_view(request):
    print("Login view llamada")
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            if user is not None:
                login(request, user)
                messages.success(request, f"¡Bienvenido, {username}!")
                if user.is_staff:
                    return redirect('/admin_dashboard/')
                else:
                    return redirect('/dashboard/')
            else:
                messages.error(request, "Usuario o contraseña inválidos.")
        else:
            messages.error(request, "Usuario o contraseña inválidos.")
    else:
        form = AuthenticationForm()
    return render(request, 'Pagina_Web/login.html', {'form': form})

def logout_view(request):
    logout(request)
    messages.info(request, "Has cerrado sesión correctamente.")
    return redirect('login')

@login_required
def dashboard_view(request):
    return render(request, 'Pagina_Web/dashboard.html')

@login_required
def admin_dashboard_view(request):
    if not request.user.is_staff:
        messages.error(request, "No tienes permisos para acceder a esta página.")
        return redirect('dashboard')
    return render(request, 'Pagina_Web/admin_dashboard.html')


# VISTAS DE LA API PARA MESAS
@csrf_exempt
def mesas_api(request, table_id=None):
    if not request.user.is_authenticated: # Asegura que el usuario esté logueado para usar la API
        return JsonResponse({'error': 'No autenticado'}, status=401)

    # Listar todas las mesas (GET /api/mesas/)
    if request.method == 'GET' and table_id is None:
        mesas = Mesa.objects.all().values('id', 'nombre', 'capacidad', 'estado')
        return JsonResponse({'mesas': list(mesas)}, safe=False)

    # Obtener detalles de una mesa específica (GET /api/mesas/<id>/)
    if request.method == 'GET' and table_id is not None:
        mesa = get_object_or_404(Mesa, id=table_id)
        return JsonResponse({
            'id': mesa.id,
            'nombre': mesa.nombre,
            'capacidad': mesa.capacidad,
            'estado': mesa.estado
        })

    # Crear una nueva mesa (POST /api/mesas/)
    if request.method == 'POST' and table_id is None:
        try:
            data = json.loads(request.body)
            nombre = data.get('nombre')
            capacidad = data.get('capacidad')
            estado = data.get('estado', 'Libre') # Default a 'Libre' si no se especifica

            if not nombre or not capacidad:
                return JsonResponse({'error': 'Nombre y capacidad son requeridos.'}, status=400)

            mesa = Mesa.objects.create(nombre=nombre, capacidad=capacidad, estado=estado)
            return JsonResponse({
                'id': mesa.id,
                'nombre': mesa.nombre,
                'capacidad': mesa.capacidad,
                'estado': mesa.estado
            }, status=201)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Formato JSON inválido.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    # Actualizar una mesa existente (PUT /api/mesas/<id>/)
    if request.method == 'PUT' and table_id is not None:
        mesa = get_object_or_404(Mesa, id=table_id)
        try:
            data = json.loads(request.body)
            mesa.nombre = data.get('nombre', mesa.nombre)
            mesa.capacidad = data.get('capacidad', mesa.capacidad)
            mesa.estado = data.get('estado', mesa.estado)
            mesa.save()
            return JsonResponse({
                'id': mesa.id,
                'nombre': mesa.nombre,
                'capacidad': mesa.capacidad,
                'estado': mesa.estado
            })
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Formato JSON inválido.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    # Eliminar una mesa (DELETE /api/mesas/<id>/)
    if request.method == 'DELETE' and table_id is not None:
        mesa = get_object_or_404(Mesa, id=table_id)
        mesa.delete()
        return JsonResponse({}, status=204) # No Content for successful deletion

    return JsonResponse({'error': 'Método no permitido o ruta inválida.'}, status=405)