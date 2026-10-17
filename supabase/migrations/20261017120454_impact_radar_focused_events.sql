-- Routine corporate transactions belong to ordinary news/announcements, not Radar.
-- Preserve the stable rule/category IDs, custom terms, evidence and user follows.
update public.impact_intake_rules
set label = 'Insolvency & disputes',
    terms = array(select distinct t from unnest(terms || array['CIRP','arbitral']) t
                  where lower(t) not in ('acquisition','merger','demerger','takeover') order by t)
where id = 'corporate_transaction';
update public.impact_categories set label = 'Insolvency & disputes' where id = 'deals';
