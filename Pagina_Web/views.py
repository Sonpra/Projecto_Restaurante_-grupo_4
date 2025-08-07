from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import login, logout, authenticate
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt # Importar para deshabilitar CSRF en API (solo para desarrollo)
import json # Para parsear el cuerpo de las peticiones POST/PUT
from .models import Mesa, Piso

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

# VISTAS DE LA API PARA PISOS
@csrf_exempt
def pisos_api(request, piso_id=None):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'No autenticado'}, status=401)
    # Listar todos los pisos (GET /api/pisos/)
    if request.method == 'GET' and piso_id is None:
        pisos = Piso.objects.all().values('id', 'nombre', 'descripcion')
        return JsonResponse({'pisos': list(pisos)}, safe=False)
    # Obtener detalles de un piso específico (GET /api/pisos/<id>/)
    if request.method == 'GET' and piso_id is not None:
        piso = get_object_or_404(Piso, id=piso_id)
        return JsonResponse({
            'id': piso.id,
            'nombre': piso.nombre,
            'descripcion': piso.descripcion
        })
    # Crear un nuevo piso (POST /api/pisos/)
    if request.method == 'POST' and piso_id is None:
        try:
            data = json.loads(request.body)
            nombre = data.get('nombre')
            if not nombre:
                return JsonResponse({'error': 'El nombre del piso es requerido.'}, status=400)
            if Piso.objects.filter(nombre=nombre).exists():
                return JsonResponse({'error': f'Ya existe un piso con el nombre "{nombre}".'}, status=409)
            piso = Piso.objects.create(nombre=nombre, descripcion=data.get('descripcion', ''))
            return JsonResponse({
                'id': piso.id,
                'nombre': piso.nombre,
                'descripcion': piso.descripcion
            }, status=201)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Formato JSON inválido.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    # Actualizar un piso existente (PUT /api/pisos/<id>/)
    if request.method == 'PUT' and piso_id is not None:
        piso = get_object_or_404(Piso, id=piso_id)
        try:
            data = json.loads(request.body)
            new_nombre = data.get('nombre', piso.nombre)
            if new_nombre != piso.nombre and Piso.objects.filter(nombre=new_nombre).exists():
                return JsonResponse({'error': f'Ya existe otro piso con el nombre "{new_nombre}".'}, status=409)
            piso.nombre = new_nombre
            piso.descripcion = data.get('descripcion', piso.descripcion)
            piso.save()
            return JsonResponse({
                'id': piso.id,
                'nombre': piso.nombre,
                'descripcion': piso.descripcion
            })
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Formato JSON inválido.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    # Eliminar un piso (DELETE /api/pisos/<id>/)
    if request.method == 'DELETE' and piso_id is not None:
        piso = get_object_or_404(Piso, id=piso_id)
        piso.delete()
        return JsonResponse({}, status=204)
    return JsonResponse({'error': 'Método no permitido o ruta inválida.'}, status=405)


# VISTAS DE LA API PARA MESAS (MODIFICADA)
@csrf_exempt
def mesas_api(request, table_id=None):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'No autenticado'}, status=401)
    # Listar todas las mesas o filtrar por piso (GET /api/mesas/?piso_id=X)
    if request.method == 'GET' and table_id is None:
        piso_id = request.GET.get('piso_id')
        mesas_query = Mesa.objects.all()
        if piso_id:
            try:
                piso_id = int(piso_id)
                mesas_query = mesas_query.filter(piso_id=piso_id)
            except ValueError:
                return JsonResponse({'error': 'ID de piso inválido.'}, status=400)
        
        mesas = mesas_query.values('id', 'nombre', 'capacidad', 'estado', 'piso__id', 'piso__nombre')
        return JsonResponse({'mesas': list(mesas)}, safe=False)
    # Obtener detalles de una mesa específica (GET /api/mesas/<id>/)
    if request.method == 'GET' and table_id is not None:
        mesa = get_object_or_404(Mesa, id=table_id)
        return JsonResponse({
            'id': mesa.id,
            'nombre': mesa.nombre,
            'capacidad': mesa.capacidad,
            'estado': mesa.estado,
            'piso_id': mesa.piso.id if mesa.piso else None,
            'piso_nombre': mesa.piso.nombre if mesa.piso else 'Sin Piso'
        })

    # Crear una nueva mesa (POST /api/mesas/)
    if request.method == 'POST' and table_id is None:
        try:
            data = json.loads(request.body)
            nombre = data.get('nombre')
            capacidad = data.get('capacidad')
            estado = data.get('estado', 'Libre')
            piso_id = data.get('piso_id') # Nuevo campo para el ID del piso
            if not nombre or not capacidad:
                return JsonResponse({'error': 'Nombre y capacidad son requeridos.'}, status=400)
            piso = None
            if piso_id:
                try:
                    piso = Piso.objects.get(id=piso_id)
                except Piso.DoesNotExist:
                    return JsonResponse({'error': 'El piso especificado no existe.'}, status=404)
            
            # Validar unicidad del nombre de la mesa por piso
            if Mesa.objects.filter(nombre=nombre, piso=piso).exists():
                return JsonResponse({'error': f'Ya existe una mesa con el nombre "{nombre}" en este piso.'}, status=409)

            mesa = Mesa.objects.create(nombre=nombre, capacidad=capacidad, estado=estado, piso=piso)
            return JsonResponse({
                'id': mesa.id,
                'nombre': mesa.nombre,
                'capacidad': mesa.capacidad,
                'estado': mesa.estado,
                'piso_id': mesa.piso.id if mesa.piso else None,
                'piso_nombre': mesa.piso.nombre if mesa.piso else 'Sin Piso'
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
            
            new_nombre = data.get('nombre', mesa.nombre)
            new_capacidad = data.get('capacidad', mesa.capacidad)
            new_estado = data.get('estado', mesa.estado)
            new_piso_id = data.get('piso_id', mesa.piso.id if mesa.piso else None)
            new_piso = None
            if new_piso_id:
                try:
                    new_piso = Piso.objects.get(id=new_piso_id)
                except Piso.DoesNotExist:
                    return JsonResponse({'error': 'El piso especificado no existe.'}, status=404)
                
            # Validar unicidad del nombre de la mesa por piso al actualizar
            if (new_nombre != mesa.nombre or new_piso != mesa.piso) and \
               Mesa.objects.filter(nombre=new_nombre, piso=new_piso).exclude(id=mesa.id).exists():
                return JsonResponse({'error': f'Ya existe otra mesa con el nombre "{new_nombre}" en este piso.'}, status=409)
            mesa.nombre = new_nombre
            mesa.capacidad = new_capacidad
            mesa.estado = new_estado
            mesa.piso = new_piso
            mesa.save()
            return JsonResponse({
                'id': mesa.id,
                'nombre': mesa.nombre,
                'capacidad': mesa.capacidad,
                'estado': mesa.estado,
                'piso_id': mesa.piso.id if mesa.piso else None,
                'piso_nombre': mesa.piso.nombre if mesa.piso else 'Sin Piso'
            })
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Formato JSON inválido.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    # Eliminar una mesa (DELETE /api/mesas/<id>/)
    if request.method == 'DELETE' and table_id is not None:
        mesa = get_object_or_404(Mesa, id=table_id)
        mesa.delete()
        return JsonResponse({}, status=204)
    return JsonResponse({'error': 'Método no permitido o ruta inválida.'}, status=405)