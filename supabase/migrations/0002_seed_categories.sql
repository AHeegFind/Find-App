-- Seed the category taxonomy. Home and Fashion only, per product decision —
-- Find launches focused on furniture/decor and fashion, not a general
-- marketplace. If you later add Lifestyle/Beauty back, insert them here
-- following the same pattern.
insert into public.categories (slug, label, parent_id, sort_order) values
  ('home', 'Home', null, 1),
  ('fashion', 'Fashion', null, 2);

insert into public.categories (slug, label, parent_id, sort_order)
select sub.slug, sub.label, c.id, sub.sort_order
from public.categories c
join (values
  ('home', 'home-furniture', 'Furniture', 1),
  ('home', 'home-sofas', 'Sofas & armchairs', 2),
  ('home', 'home-tables', 'Tables', 3),
  ('home', 'home-rugs', 'Rugs & carpets', 4),
  ('home', 'home-beds', 'Beds & bedding', 5),
  ('home', 'home-lighting', 'Lighting', 6),
  ('home', 'home-decor', 'Decor', 7),
  ('home', 'home-bathroom', 'Bathroom', 8),
  ('home', 'home-dining', 'Dining', 9),
  ('fashion', 'fashion-dresses', 'Dresses', 1),
  ('fashion', 'fashion-tops', 'Tops & shirts', 2),
  ('fashion', 'fashion-trousers', 'Trousers', 3),
  ('fashion', 'fashion-skirts', 'Skirts', 4),
  ('fashion', 'fashion-shoes', 'Shoes', 5),
  ('fashion', 'fashion-bags', 'Bags', 6),
  ('fashion', 'fashion-jewellery', 'Jewellery', 7)
) as sub(parent_slug, slug, label, sort_order) on c.slug = sub.parent_slug;
