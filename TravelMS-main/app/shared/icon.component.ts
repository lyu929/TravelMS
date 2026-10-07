import { Component, Input } from '@angular/core';
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path [attr.d]="paths[name] || paths['circle']" />
  </svg>`,
  styles: [
    ':host{display:inline-flex;width:20px;height:20px;flex-shrink:0}svg{width:100%;height:100%}',
  ],
})
export class IconComponent {
  @Input() name = 'circle';
  paths: Record<string, string> = {
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    lock: 'M5 10h14v11H5V10ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
    back: 'M20 12H4M10 6l-6 6 6 6',
    compass: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 8l-3 5-5 3 3-5 5-3Z',
    dashboard: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
    trips:
      'M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1ZM8 7V4h8v3M8 7v13M16 7v13',
    expenses: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 7h6M9 11h6M9 15h3',
    reports: 'M14 2H5v20h14V7l-5-5ZM14 2v5h5M8 12h8M8 16h8',
    users:
      'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM17 3a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-4',
    plus: 'M12 5v14M5 12h14',
    arrow: 'M4 12h16M14 6l6 6-6 6',
    search: 'M19 19l-4-4M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
    logout: 'M9 3H3v18h6M10 12h11M16 7l5 5-5 5',
    check: 'M5 12l4 4L19 6',
    close: 'M6 6l12 12M6 18L18 6',
    download: 'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5',
    edit: 'M15 4l5 5M4 15l11-11a3 3 0 0 1 5 5L9 20H4v-5Z',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
    plane: 'M22 2 9 15M22 2l-5 20-4-9-9-4 18-7Z',
    wallet: 'M3 7V4h16v3M3 7h18v14H3V7ZM15 11h6v6h-6v-6Z',
    calendar: 'M4 5h16v16H4V5ZM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2',
    location: 'M12 22s8-8 8-14A8 8 0 0 0 4 8c0 6 8 14 8 14ZM15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    circle: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    alert: 'M12 3l10 18H2L12 3ZM12 9v5M12 17h.01',
    menu: 'M3 6h18M3 12h18M3 18h18',
    leaf: 'M20 3C7 2 2 9 6 17s15 2 14-14ZM5 20l10-11',
  };
}
