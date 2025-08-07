from django.contrib import admin
from .models import Mesa, Plato, Pedido, DetallePedido

# Este código le dice a Django: "Quiero ver y poder editar estos modelos
# en el panel de administrador".
admin.site.register(Mesa)
admin.site.register(Plato)
admin.site.register(Pedido)
admin.site.register(DetallePedido)