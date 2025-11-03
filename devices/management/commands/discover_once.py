# devices/management/commands/discover_once.py
import json
from django.core.management.base import BaseCommand
from devices.net_scan import scan_subnet_once

class Command(BaseCommand):
    help = "Run a single subnet scan and print results as JSON"

    def handle(self, *args, **options):
        self.stdout.write("Starting one-time subnet scan...")
        results = scan_subnet_once()
        self.stdout.write(json.dumps(results, indent=2))
        self.stdout.write(self.style.SUCCESS(f"\nFound {len(results)} device(s)."))
