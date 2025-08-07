# MultipleFiles/models.py
from django.db import models

class Piso(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    def __str__(self):
        return self.nombre
    class Meta:
        verbose_name = "Piso"
        verbose_name_plural = "Pisos"
class Mesa(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    capacidad = models.IntegerField(default=4)
    # Opciones de estado para la mesa
    ESTADO_CHOICES = [
        ('Libre', 'Libre'),
        ('Ocupada', 'Ocupada'),
        ('Pendiente', 'Pendiente'),
    ]
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='Libre')
    # Nueva relación con Piso
    piso = models.ForeignKey(Piso, on_delete=models.SET_NULL, null=True, blank=True, related_name='mesas')
    def __str__(self):
        return f"Mesa {self.nombre} ({self.estado}) en {self.piso.nombre if self.piso else 'Sin Piso'}"
    class Meta:
        verbose_name = "Mesa"
        # Añadir una restricción para que el nombre de la mesa sea único por piso
        unique_together = ('nombre', 'piso')