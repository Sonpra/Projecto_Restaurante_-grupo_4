from django.shortcuts import render, redirect
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.models import User
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Mesa, Plato, Pedido, DetallePedido, Reserva, Incidente, Piso
from .forms import PlatoForm
from .serializers import (
    MesaSerializer, PlatoSerializer, PedidoSerializer, 
    DetallePedidoSerializer, UserSerializer, CreateUserSerializer,
    ReservaSerializer, IncidenteSerializer, PisoSerializer
)
from .permissions import IsAdminUser

# --- Vistas de Páginas HTML ---
def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username, password = form.cleaned_data.get('username'), form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            if user is not None:
                login(request, user)
                return redirect('admin_dashboard' if user.is_staff else 'dashboard')
        messages.error(request, "Usuario o contraseña inválidos.")
    form = AuthenticationForm()
    return render(request, 'Pagina_Web/login.html', {'form': form})

def logout_view(request):
    logout(request)
    messages.info(request, "Has cerrado sesión correctamente.")
    return redirect('login')

@login_required
def dashboard_view(request):
    if request.user.is_staff:
        return redirect('admin_dashboard')
    return render(request, 'Pagina_Web/dashboard.html')

@login_required
def admin_dashboard_view(request):
    if not request.user.is_staff:
        return redirect('dashboard')
    return render(request, 'Pagina_Web/admin_dashboard.html')

@login_required
def historial_view(request):
    pedidos = Pedido.objects.all().order_by('-fecha_creacion')
    return render(request, 'Pagina_Web/historial.html')

@login_required
def restaurante_view(request):
    if not request.user.is_staff:
        return redirect('dashboard') 
    return render(request, 'Pagina_Web/restaurante.html')

# --- VISTAS DE LA API (ViewSets) ---

class PisoViewSet(viewsets.ModelViewSet):
    queryset = Piso.objects.all()
    serializer_class = PisoSerializer
    permission_classes = [IsAdminUser]

class MesaViewSet(viewsets.ModelViewSet):
    queryset = Mesa.objects.all()
    serializer_class = MesaSerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'iniciar_pedido']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]

    @action(detail=True, methods=['post'])
    def iniciar_pedido(self, request, pk=None):
        mesa = self.get_object()
        if mesa.estado != 'Libre':
            return Response({'error': 'La mesa debe estar libre.'}, status=status.HTTP_400_BAD_REQUEST)
        pedido = Pedido.objects.create(mesa=mesa)
        mesa.estado = 'Ocupada'
        mesa.save()
        serializer = PedidoSerializer(pedido)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def cambiar_estado(self, request, pk=None):
        mesa = self.get_object()
        nuevo_estado = request.data.get('estado')

        if nuevo_estado not in ['Libre', 'Mantenimiento']:
            return Response(
                {'error': 'Solo se puede cambiar el estado a "Libre" o "Mantenimiento" desde aquí.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if mesa.estado == 'Ocupada':
            return Response(
                {'error': 'No se puede cambiar el estado de una mesa con un pedido activo.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        mesa.estado = nuevo_estado
        mesa.save()
        return Response(MesaSerializer(mesa).data, status=status.HTTP_200_OK)

class PlatoViewSet(viewsets.ModelViewSet):
    queryset = Plato.objects.all()
    serializer_class = PlatoSerializer
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]

class PedidoViewSet(viewsets.ModelViewSet):
    queryset = Pedido.objects.all()
    serializer_class = PedidoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['mesa', 'completado']

    @action(detail=True, methods=['post'])
    def agregar_plato(self, request, pk=None):
        pedido, plato_id = self.get_object(), request.data.get('plato_id')
        try:
            plato = Plato.objects.get(id=plato_id)
            detalle, created = DetallePedido.objects.get_or_create(pedido=pedido, plato=plato)
            if not created:
                detalle.cantidad += 1
                detalle.save()
            return Response(self.get_serializer(pedido).data)
        except Plato.DoesNotExist:
            return Response({'error': 'El plato no existe.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def remover_plato(self, request, pk=None):
        pedido, plato_id = self.get_object(), request.data.get('plato_id')
        try:
            detalle = DetallePedido.objects.get(pedido=pedido, plato_id=plato_id)
            if detalle.cantidad > 1:
                detalle.cantidad -= 1
                detalle.save()
            else:
                detalle.delete()
            return Response(self.get_serializer(pedido).data)
        except DetallePedido.DoesNotExist:
            return Response({'error': 'Este plato no está en el pedido.'}, status=status.HTTP_404_NOT_FOUND)

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
    permission_classes = [IsAuthenticated]

class ReservaViewSet(viewsets.ModelViewSet):
    queryset = Reserva.objects.all()
    serializer_class = ReservaSerializer
    permission_classes = [IsAdminUser] # Solo los admins pueden gestionar reservas

    def perform_create(self, serializer):
        reserva = serializer.save()
        mesa = reserva.mesa
        if mesa:
            mesa.estado = 'Reservada'
            mesa.save()

    def perform_destroy(self, instance):
        # Al eliminar la reserva, la mesa vuelve a estar 'Libre' si no está ocupada
        mesa = instance.mesa
        if mesa:
            mesa.estado = 'Libre'
            mesa.save()
        instance.delete()

class EmpleadoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    queryset = User.objects.filter(is_staff=False)
    def get_serializer_class(self):
        if self.action == 'create':
            return CreateUserSerializer
        return UserSerializer
    

def carta_view(request):
    platos = Plato.objects.all()
    if request.method == 'POST':
        form = PlatoForm(request.POST, request.FILES)
        if form.is_valid():
            form.save()
            return redirect('carta')
    else:
        form = PlatoForm()
    platos = Plato.objects.all()
    return render(request, 'carta.html', {'platos': platos, 'form': form})

class IncidenteViewSet(viewsets.ModelViewSet):
    queryset = Incidente.objects.all()
    serializer_class = IncidenteSerializer

    def get_permissions(self):
        # El admin (staff) puede hacer de todo.
        # El empleado (autenticado pero no staff) solo puede listar (GET) y marcar como visto.
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdminUser]
        elif self.action in ['list', 'retrieve', 'marcar_visto']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdminUser] # Por defecto, restringido
        return [permission() for permission in permission_classes]

    @action(detail=True, methods=['post'])
    def marcar_visto(self, request, pk=None):
        incidente = self.get_object()
        incidente.visto = True
        incidente.save()
        return Response({'status': 'incidente marcado como visto'}, status=status.HTTP_200_OK)