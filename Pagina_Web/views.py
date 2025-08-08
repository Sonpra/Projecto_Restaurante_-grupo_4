# Ruta: Pagina_Web/Pagina_Web/views.py
from django.shortcuts import render, redirect
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import login, logout, authenticate
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Mesa, Plato, Pedido, DetallePedido
from .serializers import MesaSerializer, PlatoSerializer, PedidoSerializer, DetallePedidoSerializer

# --- Vistas de Páginas HTML ---
def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            if user is not None:
                login(request, user)
                # La redirección ya diferencia si es admin (staff) o no
                if user.is_staff:
                    return redirect('admin_dashboard')
                else:
                    return redirect('dashboard')
        messages.error(request, "Usuario o contraseña inválidos.")
    form = AuthenticationForm()
    return render(request, 'Pagina_Web/login.html', {'form': form})

def logout_view(request):
    logout(request)
    messages.info(request, "Has cerrado sesión correctamente.")
    return redirect('login')

@login_required
def dashboard_view(request):
    context = {'is_admin': request.user.is_staff}
    return render(request, 'Pagina_Web/dashboard.html', context)

@login_required
def admin_dashboard_view(request):
    if not request.user.is_staff:
        return redirect('dashboard')
    context = {'is_admin': request.user.is_staff}
    # Por ahora, el admin usa el mismo dashboard, pero recibe is_admin = True
    return render(request, 'Pagina_Web/dashboard.html', context)

@login_required
def historial_view(request):
    return render(request, 'Pagina_Web/historial.html')


# --- VISTAS DE LA API (ViewSets sin permisos especiales) ---

class MesaViewSet(viewsets.ModelViewSet):
    queryset = Mesa.objects.all()
    serializer_class = MesaSerializer

    @action(detail=True, methods=['post'])
    def iniciar_pedido(self, request, pk=None):
        mesa = self.get_object()
        if mesa.estado == 'Ocupada':
            return Response({'error': 'La mesa ya está ocupada.'}, status=status.HTTP_400_BAD_REQUEST)
        pedido = Pedido.objects.create(mesa=mesa)
        mesa.estado = 'Ocupada'
        mesa.save()
        serializer = PedidoSerializer(pedido)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class PlatoViewSet(viewsets.ModelViewSet):
    queryset = Plato.objects.all()
    serializer_class = PlatoSerializer

class PedidoViewSet(viewsets.ModelViewSet):
    queryset = Pedido.objects.all()
    serializer_class = PedidoSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['mesa', 'completado']

    @action(detail=True, methods=['post'])
    def agregar_plato(self, request, pk=None):
        pedido = self.get_object()
        plato_id = request.data.get('plato_id')
        if not plato_id:
            return Response({'error': 'El ID del plato es requerido.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            plato = Plato.objects.get(id=plato_id)
        except Plato.DoesNotExist:
            return Response({'error': 'El plato no existe.'}, status=status.HTTP_404_NOT_FOUND)
        detalle, created = DetallePedido.objects.get_or_create(pedido=pedido, plato=plato)
        if not created:
            detalle.cantidad += 1
            detalle.save()
        serializer = self.get_serializer(pedido)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def remover_plato(self, request, pk=None):
        pedido = self.get_object()
        plato_id = request.data.get('plato_id')
        if not plato_id:
            return Response({'error': 'El ID del plato es requerido.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            detalle = DetallePedido.objects.get(pedido=pedido, plato_id=plato_id)
        except DetallePedido.DoesNotExist:
            return Response({'error': 'Este plato no se encuentra en el pedido.'}, status=status.HTTP_404_NOT_FOUND)
        if detalle.cantidad > 1:
            detalle.cantidad -= 1
            detalle.save()
        else:
            detalle.delete()
        serializer = self.get_serializer(pedido)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def finalizar(self, request, pk=None):
        pedido = self.get_object()
        pedido.completado = True
        pedido.save()
        mesa = pedido.mesa
        mesa.estado = 'Libre'
        mesa.save()
        return Response({'status': 'Pedido finalizado'}, status=status.HTTP_200_OK)

class DetallePedidoViewSet(viewsets.ModelViewSet):
    queryset = DetallePedido.objects.all()
    serializer_class = DetallePedidoSerializer
