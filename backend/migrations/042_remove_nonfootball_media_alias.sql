-- A provider search matched a hockey player with the same surname. Remove
-- the alias so future runs cannot recreate that candidate.
DELETE FROM entity_aliases
WHERE entity_id = 'uefa:player:da92bb862e1ea589a24efd46'
  AND alias = 'Erik Karlsson'
  AND source_key = 'media-identity-review';
