package com.ahmetkaragoz.ucbeyleri;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Oyunun tamamı assets/index.html içinde. Bu ekran sadece onu tam ekran gösterir.
 */
public class MainActivity extends Activity {

    static volatile boolean visible = false;   // oyun ekrandayken bildirim gösterme
    private WebView webView;
    private volatile String pushToken = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF0F1829);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // en iyi skoru kaydetmek için
        s.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient());
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // oyun içinden "Çık" denince uygulamayı kapatmak için
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface public void exit() { runOnUiThread(() -> finish()); }
            // Firebase anlık bildirim kimliği ("" = Firebase bağlı değil / henüz hazır değil)
            @JavascriptInterface public String pushToken() {
                if (pushToken.isEmpty()) pushToken = getSharedPreferences(Notif.PREFS, MODE_PRIVATE).getString("token", "");
                return pushToken;
            }
            // "granted" | "denied" | "ask"
            @JavascriptInterface public String notifState() { return notifPerm(); }
            @JavascriptInterface public void askNotify() { runOnUiThread(() -> requestNotify()); }
            // yerel zamanlayıcı bildirimlerini yeniden planla: [{k,t,title,body,ch}]
            @JavascriptInterface public void notifySet(String json) { Notif.plan(getApplicationContext(), json, true); }
        }, "UB");
        Notif.channels(this);
        initPush();
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    // Geri tuşu: önce oyun kendisi karar verir (pencereyi kapatır, sekmeye döner, çıkışı sorar)
    @Override
    public void onBackPressed() {
        webView.evaluateJavascript("(window.__back && window.__back()) ? 'y' : 'n'", v -> {
            if (v == null || !v.contains("y")) MainActivity.super.onBackPressed();
        });
    }

    private void initPush() {
        // google-services.json eklenmemişse Firebase yoktur; oyun bildirimsiz çalışmaya devam eder
        try {
            if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) return;
            com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken().addOnCompleteListener(t -> {
                if (t.isSuccessful() && t.getResult() != null) {
                    pushToken = t.getResult();
                    getSharedPreferences(Notif.PREFS, MODE_PRIVATE).edit().putString("token", pushToken).apply();
                }
            });
        } catch (Throwable ignored) {}
    }

    private String notifPerm() {
        if (Build.VERSION.SDK_INT < 33) return "granted";
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return "granted";
        return getSharedPreferences(Notif.PREFS, MODE_PRIVATE).getBoolean("asked", false) && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) ? "denied" : "ask";
    }

    private void requestNotify() {
        if (Build.VERSION.SDK_INT < 33) { jsPerm(true); return; }
        getSharedPreferences(Notif.PREFS, MODE_PRIVATE).edit().putBoolean("asked", true).apply();
        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == 7) jsPerm(res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED);
    }

    private void jsPerm(boolean ok) {
        webView.evaluateJavascript("window.__notifPerm && window.__notifPerm(" + ok + ")", null);
    }

    @Override
    protected void onPause() {
        visible = false;
        // uygulamadan çıkarken oyun bildirim planını son haliyle kursun
        webView.evaluateJavascript("window.__onPause && window.__onPause()", null);
        super.onPause(); webView.onPause();
    }

    @Override
    protected void onResume() { super.onResume(); visible = true; webView.onResume(); webView.evaluateJavascript("window.__onResume && window.__onResume()", null); }
}
