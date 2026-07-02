/**
 * Shared inventory helpers.
 *
 * Previously "low stock" was computed three different, slightly different
 * ways (App.tsx notification badge, useDashboardMetrics dashboard widget,
 * InventoryView table/stat card), which could show different counts for the
 * same underlying data. Centralizing the rule here keeps them in sync.
 */

export interface LowStockCheckable {
  currentStock: number | null | undefined;
  minThreshold: number | null | undefined;
}

/**
 * An item counts as "low stock" only when it has a meaningful (>0) minimum
 * threshold configured and current stock has dropped to or below it. Items
 * with no threshold set (null/undefined/0) are intentionally excluded so
 * that unconfigured items don't flood the low-stock alerts.
 */
export function isLowStock(item: LowStockCheckable): boolean {
  return (
    item.minThreshold != null &&
    item.minThreshold > 0 &&
    item.currentStock != null &&
    item.currentStock <= item.minThreshold
  );
}

export function countLowStock<T extends LowStockCheckable>(items: T[]): number {
  return items.reduce((count, item) => (isLowStock(item) ? count + 1 : count), 0);
}
