# MultipleFiles/models.py
from django.db import models

# --- Modelo 1: Mesa ---
class Mesa(models.Model):
    ESTADO_CHOICES = [
    ('Libre', 'Libre'),
    ('Ocupada', 'Ocupada'),
    ('Pendiente', 'Pendiente'), 
]
    nombre = models.CharField(max_length=100, unique=True)
    capacidad = models.IntegerField(default=4)
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='Libre')
    # Nueva relación con Piso
    piso = models.ForeignKey(Piso, on_delete=models.SET_NULL, null=True, blank=True, related_name='mesas')
    def __str__(self):
        return self.nombre

# --- Modelo 2: Plato (Para la "Carta") ---
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
    # Para que ImageField funcione, necesitamos instalar la librería Pillow
    imagen = models.ImageField(upload_to='platos/', null=True, blank=True)

    def __str__(self):
        # Formatea el precio con puntos como separadores de miles
        return f"{self.nombre} - ${self.precio:,.0f} CLP".replace(",",".")

# --- Modelo 3: Pedido (La cuenta de una mesa) ---
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

# --- Modelo 4: DetallePedido (Cada plato dentro de un pedido) ---
class DetallePedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE)
    plato = models.ForeignKey(Plato, on_delete=models.CASCADE)
    cantidad = models.PositiveIntegerField(default=1)

    @property
    def subtotal(self):
        return self.plato.precio * self.cantidad
    
    def __str__(self):
        return f"{self.cantidad}x {self.plato.nombre} en {self.pedido}"
