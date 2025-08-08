# Pagina_Web/Pagina_Web/serializers.py

from rest_framework import serializers
from .models import Mesa, Plato, Pedido, DetallePedido

class MesaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mesa
        fields = ['id', 'nombre', 'capacidad', 'estado']

class PlatoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plato
        fields = ['id', 'nombre', 'descripcion', 'precio', 'categoria', 'imagen']

class DetallePedidoSerializer(serializers.ModelSerializer):
    # Usamos un serializer de solo lectura para el plato para mostrar sus detalles
    plato = PlatoSerializer(read_only=True)

    class Meta:
        model = DetallePedido
        fields = ['id', 'plato', 'cantidad', 'subtotal']

class PedidoSerializer(serializers.ModelSerializer):
    # Incluimos los detalles de la mesa y los detalles del pedido
    mesa = MesaSerializer(read_only=True)
    # 'detallepedido_set' es el nombre que Django le da a la relación inversa
    # Muestra todos los detalles asociados a este pedido. 'many=True' porque son muchos.
    detalles = DetallePedidoSerializer(source='detallepedido_set', many=True, read_only=True)

    class Meta:
        model = Pedido
        fields = ['id', 'mesa', 'fecha_creacion', 'completado', 'total', 'detalles']