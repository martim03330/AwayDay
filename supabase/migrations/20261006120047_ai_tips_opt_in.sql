-- Coach tips, match-day nudges and the season recap are written by a third-party AI (Anthropic), from facts about the
-- person's match days. Apple's guideline 5.1.2(i) and the GDPR ask for explicit permission before sharing personal
-- data with a third-party AI, so they now start switched off and are only turned on when the person says yes in the
-- app (Jogos, or Definições > Notificações). Nobody gave that explicit yes before, so everyone starts from off.

alter table public.profile
  alter column nudges_enabled set default false,
  alter column recap_enabled set default false;

update public.profile set nudges_enabled = false, recap_enabled = false
where nudges_enabled or recap_enabled;
