import {expect,test} from '@playwright/test';

for(const width of [1440,768,390]) for(const locale of ['es','en']) test(`expired login recovery ${locale} ${width}`,async({page})=>{
    test.skip(process.env.E2E_BASE_URL!=='http://localhost:3000','Local UI regression only');
    await page.setViewportSize({width,height:1000});
    await page.addInitScript(locale=>localStorage.setItem('locale',locale),locale);
    let signedIn=false;
    await page.route('**/api/v1/**',async route=>{
        const path=new URL(route.request().url()).pathname;
        if(path.endsWith('/auth/login')) {signedIn=true;await route.fulfill({json:{csrf_token:'qa-only'}});}
        else if(path.endsWith('/users/me')) await route.fulfill(signedIn?{status:402,headers:{'X-WorkHive-Error-Code':'subscription.trial_expired'},json:{detail:'The company trial has expired'}}:{status:401,json:{detail:'Not authenticated'}});
        else await route.fulfill({json:[]});
    });
    await page.goto('/login');
    await page.getByRole('textbox',{name:/CORREO ELECTRÓNICO|EMAIL/i}).fill('qa-expired@example.test');
    await page.locator('input[type=password]').fill('QA-fixture-only');
    await page.getByRole('button',{name:locale==='es'?'Iniciar sesión':'Sign in',exact:true}).click();
    await expect(page.getByText(locale==='es'?'El periodo de prueba de tu empresa ha terminado.':'Your company trial has ended.',{exact:true})).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    const support=page.getByRole('link',{name:locale==='es'?'Contactar con soporte':'Contact support',exact:true});
    await expect(support).toHaveAttribute('href','/contact?reason=account-access');
    await page.screenshot({path:`/tmp/workhive-login-access-20261104/expired-${locale}-${width}.png`});
});

test('existing blocked session follows language changes and opens assisted recovery',async({page})=>{
    test.skip(process.env.E2E_BASE_URL!=='http://localhost:3000','Local UI regression only');
    await page.addInitScript(()=>localStorage.setItem('locale','es'));
    await page.route('**/api/v1/users/me',route=>route.fulfill({status:402,headers:{'X-WorkHive-Error-Code':'subscription.trial_expired'},json:{detail:'The company trial has expired'}}));
    await page.goto('/login');
    await expect(page.getByText('El periodo de prueba de tu empresa ha terminado.',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Cambiar idioma a inglés',exact:true}).click();
    await expect(page.getByText('Your company trial has ended.',{exact:true})).toBeVisible();
    await expect(page.getByText('El periodo de prueba de tu empresa ha terminado.',{exact:true})).toHaveCount(0);
    await page.getByRole('link',{name:'Contact support',exact:true}).click();
    await expect(page).toHaveURL(/\/contact\?reason=account-access$/);
    await expect(page.getByRole('textbox',{name:/subject/i})).toHaveValue('Review my company access');
});

test('retry after restored access reaches the workspace',async({page,context})=>{
    test.skip(process.env.E2E_BASE_URL!=='http://localhost:3000','Local UI regression only');
    let blocked=true;
    await page.addInitScript(()=>localStorage.setItem('locale','es'));
    await page.route('**/api/v1/**',async route=>{
        const path=new URL(route.request().url()).pathname;
        if(path.endsWith('/users/me')) await route.fulfill(blocked?{status:402,headers:{'X-WorkHive-Error-Code':'subscription.trial_expired'},json:{detail:'The company trial has expired'}}:{json:{id:1,role:{name:'viewer'},company_id:1,is_active:true,full_name:'QA'}});
        else if(path.endsWith('/companies/1')) await route.fulfill({json:{id:1,name:'QA',onboarding_completed:true,subscription_status:'active'}});
        else if(path.endsWith('/auth/login')) {
            const token=Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
            await context.addCookies([{name:'auth_token',value:`fixture.${token}.not-a-backend-token`,url:'http://localhost:3000'}]);
            await route.fulfill({json:{csrf_token:'qa-only'}});
        }
        else await route.fulfill({json:[]});
    });
    await page.goto('/login');
    await expect(page.getByText('El periodo de prueba de tu empresa ha terminado.',{exact:true})).toBeVisible();
    blocked=false;
    await page.getByRole('textbox',{name:/CORREO ELECTRÓNICO/i}).fill('qa-restored@example.test');
    await page.locator('input[type=password]').fill('QA-fixture-only');
    await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('El periodo de prueba de tu empresa ha terminado.',{exact:true})).toHaveCount(0);
});
