from django.contrib import admin
from .models import User, Subscription

# Registerig models.

admin.site.register(User)
admin.site.register(Subscription)