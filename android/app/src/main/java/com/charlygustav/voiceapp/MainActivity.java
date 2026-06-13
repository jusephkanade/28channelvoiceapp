package com.charlygustav.voiceapp;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }

    @Override
    public void onPause() {
        super.onPause();
        // Evita que Android pause la reproducción de YouTube al minimizar la app
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().onResume();
        }
    }
}
