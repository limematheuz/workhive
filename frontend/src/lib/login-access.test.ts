import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiResponseError,assertApiResponseOk} from './api.ts';
import {getLoginAccessBlock, getLoginFailureReason, getLoginFailureMessage} from './login-access.ts';

test('login feedback uses response status without exposing private diagnostics', () => {
    for (const [status, reason] of [[401, 'credentials'], [429, 'rate_limit'], [500, 'unavailable'], [403, 'unavailable']] as const) {
        const error = new ApiResponseError('Private diagnostic', status);
        assert.equal(getLoginFailureReason(error), reason);
        for (const locale of ['es', 'en'] as const) {
            assert.ok(getLoginFailureMessage(reason, locale).length > 0);
            assert.ok(!getLoginFailureMessage(reason, locale).includes(error.message));
        }
    }
    assert.equal(getLoginFailureReason(new TypeError('Failed to fetch')), 'unavailable');
    assert.notEqual(getLoginFailureMessage('credentials', 'es'), getLoginFailureMessage('credentials', 'en'));
});

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
