-- Allow negative numeric values in targets and prescription counts.
-- Unit and price columns are otherwise unconstrained and already accept signed values.
alter table public.targets
  drop constraint if exists targets_pts_nonnegative;

alter table public.hq_monthly_targets
  drop constraint if exists hq_monthly_targets_target_value_check;

alter table public.doctor_prescriptions
  drop constraint if exists doctor_prescriptions_rx_count_check;
