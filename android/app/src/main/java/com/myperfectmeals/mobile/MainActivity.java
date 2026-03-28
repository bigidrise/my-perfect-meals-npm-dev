package com.myperfectmeals.mobile;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable cookies in the WebView so session auth works reliably on Android.
        // Without this, Android 5+ may silently drop cookies between requests.
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }
    }
}
