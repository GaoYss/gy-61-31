from django.db import connection
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AccessDevice, AlarmEvent, DoorOpenLog, VisitorPass
from .serializers import AccessDeviceSerializer, AlarmEventSerializer, DoorOpenLogSerializer, VisitorPassSerializer


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        checks = {}
        overall = "healthy"

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            checks["database"] = {"status": "healthy"}
        except Exception as exc:
            checks["database"] = {"status": "unhealthy", "error": str(exc)}
            overall = "unhealthy"

        try:
            AccessDevice.objects.count()
            AlarmEvent.objects.count()
            VisitorPass.objects.count()
            DoorOpenLog.objects.count()
            checks["models"] = {"status": "healthy"}
        except Exception as exc:
            checks["models"] = {"status": "unhealthy", "error": str(exc)}
            overall = "unhealthy"

        data = {
            "status": overall,
            "timestamp": timezone.now().isoformat(),
            "version": "1.0.0",
            "checks": checks,
        }
        code = status.HTTP_200_OK if overall == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(data, status=code)


class DeviceViewSet(viewsets.ModelViewSet):
    queryset = AccessDevice.objects.all()
    serializer_class = AccessDeviceSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "device_code", "location"]
    ordering_fields = ["device_code", "last_heartbeat", "status"]


class VisitorPassViewSet(viewsets.ModelViewSet):
    serializer_class = VisitorPassSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["visitor_name", "phone", "host_name", "reason"]
    ordering_fields = ["visit_time", "created_at", "pass_status"]

    def get_queryset(self):
        queryset = VisitorPass.objects.select_related("device")
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(pass_status=status_value)
        return queryset


class AlarmViewSet(viewsets.ModelViewSet):
    serializer_class = AlarmEventSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "description", "handled_by"]
    ordering_fields = ["occurred_at", "level", "status"]

    def get_queryset(self):
        queryset = AlarmEvent.objects.select_related("device")
        status_value = self.request.query_params.get("status")
        level = self.request.query_params.get("level")
        if status_value:
            queryset = queryset.filter(status=status_value)
        if level:
            queryset = queryset.filter(level=level)
        return queryset


class DoorLogViewSet(viewsets.ModelViewSet):
    serializer_class = DoorOpenLogSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["opener_name", "failure_reason", "device__name", "device__location"]
    ordering_fields = ["opened_at", "result", "opener_type"]

    def get_queryset(self):
        queryset = DoorOpenLog.objects.select_related("device", "visitor_pass")
        result = self.request.query_params.get("result")
        opener_type = self.request.query_params.get("opener_type")
        keyword = self.request.query_params.get("keyword")
        if result:
            queryset = queryset.filter(result=result)
        if opener_type:
            queryset = queryset.filter(opener_type=opener_type)
        if keyword:
            queryset = queryset.filter(
                Q(opener_name__icontains=keyword)
                | Q(device__name__icontains=keyword)
                | Q(device__location__icontains=keyword)
            )
        return queryset


class StatsView(APIView):
    def get(self, request):
        today = timezone.localdate()
        return Response(
            {
                "devices_total": AccessDevice.objects.count(),
                "devices_online": AccessDevice.objects.filter(status=AccessDevice.Status.ONLINE).count(),
                "visitors_pending": VisitorPass.objects.filter(pass_status=VisitorPass.PassStatus.PENDING).count(),
                "open_alarms": AlarmEvent.objects.exclude(status=AlarmEvent.Status.RESOLVED).count(),
                "today_success_logs": DoorOpenLog.objects.filter(
                    result=DoorOpenLog.Result.SUCCESS,
                    opened_at__date=today,
                ).count(),
                "logs_by_method": list(
                    DoorOpenLog.objects.values("credential_method").annotate(count=Count("id")).order_by("credential_method")
                ),
            }
        )
