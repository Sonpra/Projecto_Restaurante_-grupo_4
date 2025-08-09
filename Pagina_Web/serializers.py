from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Mesa, Plato, Pedido, DetallePedido, Perfil, Reserva, Incidente, Piso

class MesaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mesa
        fields = ['id', 'nombre', 'capacidad', 'estado', 'piso']

class PisoSerializer(serializers.ModelSerializer):
    mesas = MesaSerializer(many=True, read_only=True) # Incluye las mesas de cada piso

    class Meta:
        model = Piso
        fields = ['id', 'nombre', 'numero', 'mesas']

class PlatoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plato
        fields = ['id', 'nombre', 'descripcion', 'precio', 'categoria', 'imagen']

class DetallePedidoSerializer(serializers.ModelSerializer):
    plato = PlatoSerializer(read_only=True)
    class Meta:
        model = DetallePedido
        fields = ['id', 'plato', 'cantidad', 'subtotal']

class PedidoSerializer(serializers.ModelSerializer):
    mesa = MesaSerializer(read_only=True)
    detalles = DetallePedidoSerializer(source='detallepedido_set', many=True, read_only=True)
    class Meta:
        model = Pedido
        fields = ['id', 'mesa', 'fecha_creacion', 'completado', 'total', 'detalles']


class PerfilSerializer(serializers.ModelSerializer):
    class Meta:
        model = Perfil
        fields = ['rut', 'fecha_nacimiento', 'nacionalidad']

class UserSerializer(serializers.ModelSerializer):
    perfil = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'perfil']

    def get_perfil(self, obj):
        """
        Esta función se ejecuta para el campo 'perfil'.
        Intenta obtener el perfil del usuario. Si no existe, devuelve None.
        """
        try:
            return PerfilSerializer(obj.perfil).data
        except Perfil.DoesNotExist:
            return None

class CreateUserSerializer(serializers.ModelSerializer):
    perfil = PerfilSerializer(required=True)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'password', 'first_name', 'last_name', 'perfil']
    
    def create(self, validated_data):
        perfil_data = validated_data.pop('perfil')
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            is_staff=False
        )
        Perfil.objects.create(user=user, **perfil_data)
        return user
class ReservaSerializer(serializers.ModelSerializer):
    # Para mostrar el nombre de la mesa en lugar de solo su ID
    mesa_nombre = serializers.CharField(source='mesa.nombre', read_only=True)

    class Meta:
        model = Reserva
        # 'mesa' es para escribir (enviar el ID), 'mesa_nombre' es para leer
        fields = ['id', 'mesa', 'mesa_nombre', 'nombre_cliente', 'fecha_hora', 'cantidad_personas', 'notas']

class IncidenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incidente
        fields = ['id', 'tipo', 'mensaje', 'fecha_creacion', 'visto']