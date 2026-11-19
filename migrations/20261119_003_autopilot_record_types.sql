-- Extend the Owner-scoped operational record registry for durable AutoPilot state.
BEGIN;

ALTER TABLE owner_operational_records
  DROP CONSTRAINT IF EXISTS owner_operational_records_record_type_check;

ALTER TABLE owner_operational_records
  ADD CONSTRAINT owner_operational_records_record_type_check
  CHECK (record_type IN (
    'video_job',
    'autopilot_task',
    'autopilot_workflow',
    'workflow_execution',
    'publishing_post',
    'sheets_sync_record',
    'change_proposal',
    'worker_agent',
    'payout_request',
    'verified_earning',
    'autopilot_config',
    'content_run',
    'content_slot'
  ));

COMMIT;
