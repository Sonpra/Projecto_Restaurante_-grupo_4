from django.contrib import admin
from django.urls import path, re_path # Importa re_path para URLs con IDs
from Pagina_Web import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('admin_dashboard/', views.admin_dashboard_view, name='admin_dashboard'),

    # Rutas para la API de Mesas
    path('api/mesas/', views.mesas_api, name='mesas_list_create'),
    re_path(r'^api/mesas/(?P<table_id>\d+)/$', views.mesas_api, name='mesas_detail'),

    # NUEVAS Rutas para la API de Pisos
    path('api/pisos/', views.pisos_api, name='pisos_list_create'),
    re_path(r'^api/pisos/(?P<piso_id>\d+)/$', views.pisos_api, name='pisos_detail'),
    
    path('', views.login_view, name='root_login'),
]