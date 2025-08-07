from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from Pagina_Web import views

router = DefaultRouter()
router.register(r'mesas', views.MesaViewSet, basename='mesa')
router.register(r'platos', views.PlatoViewSet, basename='plato')
router.register(r'pedidos', views.PedidoViewSet, basename='pedido')
router.register(r'detalles', views.DetallePedidoViewSet, basename='detallepedido')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Rutas de autenticación y páginas
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('admin_dashboard/', views.admin_dashboard_view, name='admin_dashboard'),
    path('historial/', views.historial_view, name='historial'),

    # Rutas de la API (definida una sola vez)
    path('api/', include(router.urls)),
]