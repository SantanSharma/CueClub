import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'operations' },
  {
    path: 'operations',
    loadComponent: () => import('./features/operations/operations-page').then((m) => m.OperationsPage),
  },
  {
    path: 'customers',
    loadComponent: () => import('./features/customers/customers-list-page').then((m) => m.CustomersListPage),
  },
  {
    path: 'customers/:id',
    loadComponent: () => import('./features/customers/customer-profile-page').then((m) => m.CustomerProfilePage),
  },
  {
    path: 'inventory',
    loadComponent: () => import('./features/inventory/inventory-list-page').then((m) => m.InventoryListPage),
  },
  {
    path: 'inventory/:id',
    loadComponent: () => import('./features/inventory/inventory-detail-page').then((m) => m.InventoryDetailPage),
  },
  {
    path: 'analytics',
    loadComponent: () => import('./features/analytics/analytics-page').then((m) => m.AnalyticsPage),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  // Legacy paths from the previous navigation model.
  { path: 'dashboard', redirectTo: 'analytics' },
  { path: 'reports', redirectTo: 'analytics' },
  { path: 'bookings', redirectTo: 'operations' },
  { path: 'sales', redirectTo: 'operations' },
  { path: '**', redirectTo: 'operations' },
];
