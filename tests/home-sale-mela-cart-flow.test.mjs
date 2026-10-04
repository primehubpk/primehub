import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

test('home Sale Mela keeps exact medallion-price cards first and higher prices in the trail', () => {
  const source = read('components/home/HomeCollections.tsx');

  assert.match(source, /function buildHomeTwoRowProducts\(/);
  assert.match(source, /const exactPrice = shuffleWithNewArrivalPriority\(/);
  assert.match(source, /homePrice\(product\) === amount/);
  assert.match(source, /const higherPriceTrail = shuffleWithNewArrivalPriority\(/);
  assert.match(source, /homePrice\(product\) > amount/);
  assert.match(source, /return \[\.\.\.exactPrice, \.\.\.higherPriceTrail\]/);
  assert.match(source, /setHomeShuffleSeed\(railSeed\(\)\)/);
  assert.match(source, /homeShuffleSeed \|\| stableCatalogSeed/);
  assert.match(source, /buildHomeTwoRowProducts\([\s\S]*?baseMatches,[\s\S]*?amount,[\s\S]*?saleShuffleSeed,[\s\S]*?wholesale/);
  assert.match(source, /matchesSaleMelaBucket\(price, amount\)/);
  assert.match(source, /gridTemplateColumns: "none"/);
  assert.match(source, /gridAutoFlow: "column"/);
  assert.match(source, /gridTemplateRows: "repeat\(2, auto\)"/);
  assert.match(source, /gridAutoColumns: "calc\(\(100% - 10px\) \/ 2\)"/);

  assert.match(source, /const topRowCount = Math\.ceil\(products\.length \/ 2\)/);
  assert.match(source, /const \[homeSaleCatalog, setHomeSaleCatalog\] = useState<Product\[\]>/);
  assert.match(source, /homeSaleCatalog\.length > 0/);
  assert.match(source, /setHomeSaleCatalog\(liveCatalog\)/);
});

test('home Add to Cart checks the fresh product before deciding variants or stock', () => {
  const source = read('components/home/HomeCollections.tsx');

  assert.match(source, /async function add\(\)/);
  assert.match(source, /\/api\/storefront\/read\?type=product&id=/);
  assert.match(source, /productHasVariants\(currentProduct\)/);
  assert.match(source, /availableStockOf\(currentProduct\) <= 0/);
  assert.match(source, /productId: currentProduct\.id/);
});

test('variant UI only opens for real saved rows and missing stock safely defaults to 30', () => {
  const shopTypes = read('components/shop/ShopTypes.ts');
  const cartStore = read('lib/productVariants.ts');

  assert.match(shopTypes, /return variantRowsOf\(p\)\.some/);
  assert.doesNotMatch(shopTypes, /p\.hasVariants === true \|\|/);
  assert.match(shopTypes, /rawParentStock == null \|\| rawParentStock === ''[\s\S]*\? 30/);

  assert.match(cartStore, /const hasVariantRows = sourceRows\.length > 0/);
  assert.match(cartStore, /if \(!hasVariantRows\) return \{ hasVariants: false/);
  assert.doesNotMatch(cartStore, /if \(!allSourceRows\.length\) \{/);
  assert.match(cartStore, /row\.stock == null \|\| row\.stock === ''[\s\S]*\? parentStock/);
});

test('bot/admin stock defaults stay at 30 and the active test branch is Vercel-disabled', () => {
  const sync = read('lib/productSync.ts');
  const types = read('components/admin/products/ProductTypes.ts');
  const manager = read('components/admin/products/useProductsManager.ts');
  const vercel = JSON.parse(read('vercel.json'));

  assert.match(sync, /stock: Math\.max\(0, asNumber\(input\.stock, 30\)\)/);
  assert.match(sync, /rawStock == null \|\| rawStock === ''[\s\S]*\? 30/);
  assert.match(types, /stock:'30'/);
  assert.match(manager, /form\.stock \|\| '30'/);
  assert.match(manager, /row\.stock \?\? legacyStock \?\? 30/);
  assert.equal(vercel.git?.deploymentEnabled?.['fix/home-rails-deals-usage-sep29'], false);
  assert.equal(vercel.git?.deploymentEnabled?.['fix/home-sale-mela-layout-shuffle-oct02'], false);
});


test('New Arrivals places View all on the right with a forward arrow', () => {
  const heading = read('components/home/HomeHeading.tsx');
  const css = read('components/home/home.css');

  assert.match(heading, /"New Arrivals":[\s\S]*?label: "View all"[\s\S]*?actionPlacement: "right"[\s\S]*?actionArrow: true/);
  assert.match(heading, /const actionOnRight = destination\.actionPlacement === "right"/);
  assert.match(heading, /destination\.actionArrow \? <span aria-hidden="true">→<\/span>/);
  assert.match(css, /\.home-sale-home\s*\{[\s\S]*?margin-top: 2px;[\s\S]*?padding-top: 0;/);
  assert.match(css, /\.home-sale\.home-sale-home > h2\s*\{[\s\S]*?margin-top: 0;[\s\S]*?margin-bottom: 10px;/);
});


test('homepage reuses the existing standalone Sale Mela where PrimeHubMall Deals used to render', () => {
  const home = read('components/HomePageClient.tsx');

  assert.doesNotMatch(home, /import ProductGridRewards/);
  assert.doesNotMatch(home, /<ProductGridRewards/);
  assert.match(
    home,
    /<HomeCategoryDeals[\s\S]*?<div id="discover-deals-section">[\s\S]*?<HomeCollections[\s\S]*?products=\{products\}[\s\S]*?standalone/,
  );
});


test('homepage wholesale Sale Mela rail is pulled upward without changing standalone layout', () => {
  const source = read('components/home/HomeCollections.tsx');
  const css = read('components/home/home.css');

  assert.match(source, /home-sale-wholesale-frame/);
  assert.match(css, /\.home-sale-home-frame\.home-sale-wholesale-frame\s*\{[\s\S]*?margin-top: -14px;/);
});


test('homepage category rails stay anchored to the first card while keeping refresh shuffle', () => {
  const source = read('components/home/HomeCategoryDeals.tsx');

  assert.match(source, /setRefreshSeed\(railSeed\(\)\)/);
  assert.match(source, /orderHomeProducts\(/);
  assert.match(source, /data-home-category-rail/);
  assert.match(source, /rail\.scrollLeft = 0/);
  assert.match(source, /overscrollBehaviorX: 'none'/);
  assert.match(source, /direction: 'ltr'/);
});


test('embedded home Sale Mela hides retail browse headers but keeps wholesale header', () => {
  const home = read('components/HomePageClient.tsx');
  const collections = read('components/home/HomeCollections.tsx');
  const frame = read('components/home/HomeRailFrame.tsx');

  assert.match(home, /<HomeCollections[\s\S]*?standalone[\s\S]*?embeddedHome/);
  assert.match(collections, /hideHeader=\{standalone && embeddedHome && !wholesale\}/);
  assert.match(frame, /!hideHeader \? \(/);
});

test('embedded standalone retail Sale Mela renders every matched product without a display limit', () => {
  const source = read('components/home/HomeCollections.tsx');

  assert.match(source, /const matches = standalone[\s\S]*?: baseMatches/);
  assert.match(source, /matches\.map\(\(product\) =>/);
  assert.doesNotMatch(source, /matches\.slice\(/);
});


test('homepage commerce rails use only their card headers with compact spacing', () => {
  const source = read('components/home/HomeCommerceRails.tsx');
  const css = read('components/home/HomeCommerceRails.css');

  assert.doesNotMatch(source, /import HomeHeading/);
  assert.doesNotMatch(source, /<HomeHeading>Wholesale Packages<\/HomeHeading>/);
  assert.doesNotMatch(source, /<HomeHeading>Prime Skills<\/HomeHeading>/);
  assert.match(source, /<HomeRailFrame title="Wholesale Packages"/);
  assert.match(source, /<HomeRailFrame title="Prime Skills"/);
  assert.match(css, /\.home-commerce-section\s*\{[\s\S]*?margin-top: 10px;/);
  assert.match(css, /\.home-commerce-section \+ \.home-commerce-section\s*\{[\s\S]*?margin-top: 10px;/);
});


test('mobile wholesale and Prime Skills cards use 16:9 thumbnails with a larger swipe trail', () => {
  const css = read('components/home/HomeCommerceRails.css');
  const source = read('components/home/HomeCommerceRails.tsx');

  assert.match(css, /\.home-video-packages \.home-commerce-card\s*\{[\s\S]*?flex(?:-basis)?: 82%;/);
  assert.match(css, /\.home-prime-skills \.home-commerce-card\s*\{[\s\S]*?flex(?:-basis)?: 86%;/);
  assert.match(css, /\.home-video-packages \.home-commerce-media,[\s\S]*?\.home-prime-skills \.home-commerce-media\s*\{[\s\S]*?aspect-ratio: 16 \/ 9;/);
  assert.match(css, /\.home-prime-skills \.home-commerce-media > img\s*\{[\s\S]*?object-fit: contain;/);
  assert.match(css, /\.home-video-packages \.home-commerce-rail\s*\{[\s\S]*?display: flex;/);
  assert.match(source, /Wholesale packages\. Swipe horizontally for more\./);
});


test('existing full Prime Skills showcase sits below the embedded Sale Mela', () => {
  const home = read('components/HomePageClient.tsx');
  const page = read('app/page.tsx');
  const skills = read('components/SkillsShowcase.tsx');

  assert.match(
    home,
    /<div id="discover-deals-section">[\s\S]*?<HomeCollections[\s\S]*?standalone[\s\S]*?embeddedHome[\s\S]*?<SkillsShowcase[\s\S]*?embedded/,
  );
  assert.match(page, /getPrimeSkillsSnapshot\(\)/);
  assert.match(page, /initialSkills=\{initialSkills\}/);
  assert.match(page, /initialSkillsPage=\{initialSkillsPage\}/);
  assert.match(skills, /const Shell = embedded \? 'section' : 'main'/);
  assert.match(skills, /visibleItems\.map\(\(item, index\) =>/);
  assert.doesNotMatch(skills, /visibleItems\.slice\(/);
});


test('Prime Family reuses one guest-visible dashboard on route and home while reward claims stay login-gated', () => {
  const nav = read('components/BottomNav.tsx');
  const dashboardPage = read('app/reseller/dashboard/page.tsx');
  const dashboard = read('components/reseller/PrimeFamilyDashboard.tsx');
  const home = read('components/HomePageClient.tsx');
  const join = read('app/reseller/join/page.tsx');

  assert.match(nav, /key: 'reseller', label: 'Prime Family', href: RESELLER_DASHBOARD/);
  assert.doesNotMatch(nav, /RESELLER_JOIN/);
  assert.match(dashboardPage, /<PrimeFamilyDashboard \/>/);
  assert.doesNotMatch(dashboard, /router\.replace\('\/reseller\/join'\)/);
  assert.match(dashboard, /Sign In \/ Join/);
  assert.match(dashboard, /Prime Family Guest/);
  assert.match(dashboard, /if \(!user \|\| rewardBusy/);
  assert.match(dashboard, /if \(!user \|\| spinning/);
  assert.match(dashboard, /view === 'wallet'/);
  assert.doesNotMatch(dashboard, /view === 'home' && <section[^>]*>[\s\S]*?>Wallet<\/span>/);
  assert.match(dashboard, /Cash Wallet/);
  assert.match(
    home,
    /<SkillsShowcase[\s\S]*?embedded[\s\S]*?<HomePrimeFamilyLazy[\s\S]*?initialSettings=/,
  );
  const lazy = read('components/home/HomePrimeFamilyLazy.tsx');
  assert.match(lazy, /IntersectionObserver/);
  assert.match(lazy, /rootMargin: '1200px 0px'/);
  assert.match(lazy, /<PrimeFamilyDashboard[\s\S]*?embedded[\s\S]*?initialSettings=/);
  assert.doesNotMatch(home, /HomeResellerClubFull/);
  assert.doesNotMatch(join, /ResellerTasksContent/);
  assert.match(join, /signInReseller\(email, password, rememberMe\)/);
  assert.match(join, /createResellerAccount\(email, password\)/);
});


test('homepage keeps Wholesale Packages above the small Prime Skills rail in single-row trails', () => {
  const home = read('components/HomePageClient.tsx');
  const css = read('components/home/HomeCommerceRails.css');

  assert.match(
    home,
    /<HomeWholesaleVideos \/>[\s\S]*?<HomePrimeSkills initialItems=\{initialSkills\} \/>[\s\S]*?<HomeCategoryDeals/,
  );
  assert.match(css, /\.home-video-packages\s*\{[\s\S]*?margin-top: -14px;/);
  assert.match(css, /\.home-commerce-section \.home-commerce-rail\s*\{[\s\S]*?display: flex;/);
  assert.match(css, /\.home-commerce-section \.home-commerce-card\s*\{[\s\S]*?flex: 0 0/);
});


test('homepage avoids redundant skills/settings reads before lower sections are needed', () => {
  const home = read('components/HomePageClient.tsx');
  const commerce = read('components/home/HomeCommerceRails.tsx');
  const dashboard = read('components/reseller/PrimeFamilyDashboard.tsx');
  const lazy = read('components/home/HomePrimeFamilyLazy.tsx');

  assert.match(home, /<HomePrimeSkills initialItems=\{initialSkills\} \/>/);
  assert.match(commerce, /if \(initialItems\.length\) \{[\s\S]*?setItems\(initialItems\);[\s\S]*?return;/);
  assert.match(lazy, /setReady\(true\)/);
  assert.match(dashboard, /hasSeededSettings/);
  assert.match(dashboard, /Promise\.resolve<Response \| null>\(null\)/);
});
