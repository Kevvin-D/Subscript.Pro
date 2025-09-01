from django.urls import path
from ..views import SubscriptionListCreateView, SubscriptionDestroyView, SubscriptionRetrieveUpdateDestroyView

urlpatterns = [
    path('<int:pk>/', SubscriptionRetrieveUpdateDestroyView.as_view(), name='subscription-detail'),
    path('', SubscriptionListCreateView.as_view(), name='subscription-list-create'),
    path('delete/<int:pk>/', SubscriptionDestroyView.as_view(), name='subscription-delete'),
    path('add/', SubscriptionListCreateView.as_view(), name='subscription-add'),
]