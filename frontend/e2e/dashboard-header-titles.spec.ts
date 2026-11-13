import {expect, test} from '@playwright/test';

for (const width of [1440,768,390]) for (const locale of ['es','en']) for (const section of ['inventory','task-reports','documents','assets']) {
    test(`header ${section} ${locale} ${width}`, async ({context,page}) => {
        test.skip(process.env.E2E_BASE_URL !== 'http://localhost:3000', 'Local UI regression only');
        await page.setViewportSize({width,height:900});
        const token = Buffer.from(JSON.stringify({exp: Math.floor(Date.now()/1000)+3600})).toString('base64url');
        await context.addCookies([{name:'auth_token',value:`fixture.${token}.not-a-backend-token`,url:'http://localhost:3000'}]);
        await page.addInitScript(locale => localStorage.setItem('locale',locale),locale);
        await page.route('**/api/v1/**', async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/,'');
            let data: unknown = [];
            if(path.endsWith('/users/me')) data={id:1,company_id:1,role:{name:'admin'},full_name:'QA Header',is_active:true};
            else if(path.endsWith('/companies/1')) data={id:1,name:'QA',onboarding_completed:true,subscription_status:'active'};
            else if(path.endsWith('/organization/access')) data={'inventory.read':true,'inventory.manage':true};
            await route.fulfill({json:data});
        });
        await page.goto(`/dashboard/${section}`);
        const titles = {
            inventory: locale === 'es' ? 'Inventario' : 'Inventory',
            'task-reports': locale === 'es' ? 'Reportes de campo' : 'Field reports',
            documents: locale === 'es' ? 'Documentos' : 'Documents',
            assets: locale === 'es' ? 'Activos' : 'Assets',
        };
        const title = titles[section as keyof typeof titles];
        await expect(page.getByRole('banner').getByRole('heading',{name:title,exact:true})).toBeVisible();
        await page.screenshot({path:`/tmp/workhive-header-20261103/${section}-${locale}-${width}.png`});
    });
}
