-- Quartermaster barcode telemetry.
--
-- Build 22 added native barcode scanning. These event types let
-- Quartermaster see scanner lookup quality, fallback behavior, edits, and
-- barcode-backed saves without changing scanner UX or product promotion.

ALTER TABLE food_log_events
  DROP CONSTRAINT IF EXISTS food_log_events_event_type_check;

ALTER TABLE food_log_events
  ADD CONSTRAINT food_log_events_event_type_check
  CHECK (
    event_type IN (
      'parse_requested',
      'parse_returned',
      'parse_failed',
      'parse_abandoned',
      'food_item_edited',
      'food_item_deleted',
      'food_item_added',
      'disambiguation_selected',
      'save_requested',
      'save_succeeded',
      'save_failed',
      'quick_add_after_parse',
      'retry_after_parse',
      'barcode_scan_started',
      'barcode_scan_resolved',
      'barcode_scan_failed',
      'barcode_product_selected',
      'barcode_product_edited',
      'barcode_log_saved'
    )
  );
