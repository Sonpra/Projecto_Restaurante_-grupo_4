from django.db import models

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

    def __str__(self):
        return f"Mesa {self.nombre} ({self.estado})"

    class Meta:
        verbose_name = "Mesa"