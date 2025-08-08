from django.contrib import admin
from .models import Mesa, Plato, Pedido, DetallePedido

admin.site.register(Mesa)
admin.site.register(Plato)
admin.site.register(Pedido)
admin.site.register(DetallePedido)
