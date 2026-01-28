package com.rjkyker.termuxapp;

import android.os.Bundle;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        TextView tv = new TextView(this);
        tv.setText("RJ – your Termux-built APK is running.");
        tv.setTextSize(20f);
        int padding = (int) (16 * getResources().getDisplayMetrics().density);
        tv.setPadding(padding, padding, padding, padding);

        setContentView(tv);
    }
}
