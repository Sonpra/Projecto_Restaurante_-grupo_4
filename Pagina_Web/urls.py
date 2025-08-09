from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from rest_framework.routers import DefaultRouter
from Pagina_Web import views

router = DefaultRouter()
router.register(r'mesas', views.MesaViewSet, basename='mesa')
router.register(r'platos', views.PlatoViewSet, basename='plato')
router.register(r'pedidos', views.PedidoViewSet, basename='pedido')
router.register(r'detalles', views.DetallePedidoViewSet, basename='detallepedido')
router.register(r'empleados', views.EmpleadoViewSet, basename='empleado')
router.register(r'reservas', views.ReservaViewSet, basename='reserva')
router.register(r'incidentes', views.IncidenteViewSet, basename='incidente')
router.register(r'pisos', views.PisoViewSet, basename='piso')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('admin_dashboard/', views.admin_dashboard_view, name='admin_dashboard'),
    path('historial/', views.historial_view, name='historial'),
    path('restaurante/', views.restaurante_view, name='restaurante'),
    path('carta/', views.carta_view, name='carta'),
    path('api/', include(router.urls)),
    path('', lambda request: redirect('login')),
]