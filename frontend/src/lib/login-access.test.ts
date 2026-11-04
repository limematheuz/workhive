import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiResponseError,assertApiResponseOk} from './api.ts';
import {getLoginAccessBlock} from './login-access.ts';

test('subscription response preserves canonical header code for login recovery',async()=>{
    await assert.rejects(assertApiResponseOk(new Response(JSON.stringify({detail:'The company trial has expired'}),{status:402,headers:{'X-WorkHive-Error-Code':'subscription.trial_expired'}}),'Fallback'),error=>{
        assert.ok(error instanceof ApiResponseError);
        assert.equal(getLoginAccessBlock(error),'trial_expired');
        return true;
    });
});
test('only payment-blocked identities show subscription recovery',()=>{
    for(const status of [400,401,403,404,429,500]) assert.equal(getLoginAccessBlock(new ApiResponseError('Denied',status,'subscription.trial_expired')),null);
    assert.equal(getLoginAccessBlock(new Error('The company trial has expired')),null);
    assert.equal(getLoginAccessBlock(new ApiResponseError('Unknown reason',402)),'unavailable');
});
test('structured API code takes precedence over header fallback',async()=>{
    await assert.rejects(assertApiResponseOk(new Response(JSON.stringify({detail:{message:'Blocked',code:'subscription.paused'}}),{status:402,headers:{'X-WorkHive-Error-Code':'subscription.trial_expired'}}),'Fallback'),error=>{
        assert.ok(error instanceof ApiResponseError);
        assert.equal(error.code,'subscription.paused');
        assert.equal(getLoginAccessBlock(error),'unavailable');
        return true;
    });
});
