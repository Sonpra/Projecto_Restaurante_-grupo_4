from django.db import models
from django.contrib.auth.models import User

class Piso(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    numero = models.PositiveIntegerField(unique=True, help_text="Número para ordenar los pisos. Ej: 1, 2, 3...")

    class Meta:
        ordering = ['numero']

    def __str__(self):
        return self.nombre

class Perfil(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    
    rut = models.CharField(max_length=12, blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    nacionalidad = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return f'Perfil de {self.user.username}'

class Mesa(models.Model):
    ESTADO_CHOICES = [
        ('Libre', 'Libre'),
        ('Ocupada', 'Ocupada'),
        ('Reservada', 'Reservada'),
        ('Mantenimiento', 'Mantenimiento'),
    ]
    nombre = models.CharField(max_length=100)
    capacidad = models.IntegerField(default=4)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='Libre')
    piso = models.ForeignKey(Piso, on_delete=models.CASCADE, related_name='mesas')

    class Meta:
        # Nombre único dentro de cada piso
        unique_together = ('piso', 'nombre')
        ordering = ['piso__numero', 'nombre']

    def __str__(self):
        return f"{self.nombre} ({self.piso.nombre})"

class Plato(models.Model):
    CATEGORIA_CHOICES = [
        ('Entrada', 'Entrada'),
        ('Fondo', 'Plato de Fondo'),
        ('Postre', 'Postre'),
        ('Bebida', 'Bebida'),
    ]
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    precio = models.IntegerField()
    categoria = models.CharField(max_length=20, choices=CATEGORIA_CHOICES)
    imagen = models.ImageField(upload_to='platos/', null=True, blank=True)

    def __str__(self):
        return f"{self.nombre} - ${self.precio:,.0f} CLP".replace(",",".")

class Pedido(models.Model):
    mesa = models.ForeignKey(Mesa, on_delete=models.CASCADE)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    completado = models.BooleanField(default=False)
    
    @property
    def total(self):
        detalles = self.detallepedido_set.all()
        total_pedido = sum([item.subtotal for item in detalles])
        return total_pedido

    def __str__(self):
        return f"Pedido de {self.mesa.nombre} - {'Completado' if self.completado else 'Abierto'}"

class DetallePedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE)
    plato = models.ForeignKey(Plato, on_delete=models.CASCADE)
    cantidad = models.PositiveIntegerField(default=1)

    @property
    def subtotal(self):
        return self.plato.precio * self.cantidad
    
    def __str__(self):
        return f"{self.cantidad}x {self.plato.nombre} en {self.pedido}"
    
class Reserva(models.Model):
    mesa = models.ForeignKey(Mesa, on_delete=models.SET_NULL, null=True)
    nombre_cliente = models.CharField(max_length=100)
    fecha_hora = models.DateTimeField()
    cantidad_personas = models.PositiveIntegerField()
    notas = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['fecha_hora']

    def __str__(self):
        try:
            nombre_mesa = self.mesa.nombre
        except AttributeError:
            nombre_mesa = "Mesa eliminada"
        return f"Reserva de {self.nombre_cliente} para la {nombre_mesa} el {self.fecha_hora.strftime('%d/%m/%Y %H:%M')}"

class Incidente(models.Model):
    TIPO_CHOICES = [
        ('Queja', 'Queja'),
        ('Sugerencia', 'Sugerencia'),
    ]
    
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    mensaje = models.TextField()
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    visto = models.BooleanField(default=False)

    class Meta:
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"{self.tipo} - {self.fecha_creacion.strftime('%d/%m/%Y')}"