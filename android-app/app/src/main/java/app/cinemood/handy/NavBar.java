package app.cinemood.handy;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.widget.LinearLayout;

/**
 * Navigationsleiste unten, gleich wie in der Web-App: Die runden Bubbles stehen frei, die Leiste
 * beginnt auf halber Bubble-Höhe, ist oben gerade und hat unter jeder Bubble eine runde Mulde mit
 * abgerundeten Kanten.
 */
public class NavBar extends LinearLayout {
    /** Bubble-Mitte über der Oberkante der Leiste (halbe Bubble, 56 dp). */
    private static final float BUBBLE_HALF_DP = 28f;
    /** Radius der Mulde (Bubble plus etwas Luft) und der abgerundeten Kanten. */
    private static final float CRADLE_DP = 34f;
    private static final float FILLET_DP = 12f;

    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint edge = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF oval = new RectF();

    public NavBar(Context context, AttributeSet attrs) {
        super(context, attrs);
        setWillNotDraw(false);
        fill.setColor(context.getColor(R.color.bar));
        edge.setColor(context.getColor(R.color.bar_edge));
        edge.setStyle(Paint.Style.STROKE);
        edge.setStrokeWidth(dp(1));
    }

    private float dp(float v) {
        return v * getResources().getDisplayMetrics().density;
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        buildPath(w, h);
    }

    private void buildPath(int w, int h) {
        float top = getPaddingTop() + dp(BUBBLE_HALF_DP);
        float big = dp(CRADLE_DP);
        float small = dp(FILLET_DP);
        float d = (float) Math.sqrt((big + small) * (big + small) - small * small);
        float k = big / (big + small);
        // Winkel (Grad, im Uhrzeigersinn ab 3 Uhr) der Berührpunkte Kante/Mulde
        float angle = (float) Math.toDegrees(Math.atan2(small * k, d * k));
        int count = Math.max(1, getChildCount());

        path.reset();
        path.moveTo(-dp(1), top);
        for (int i = 0; i < count; i++) {
            float c = (i + 0.5f) * w / count;
            path.lineTo(c - d, top);
            // linke abgerundete Kante: Kreis um (c-d, top+small), von oben nach rechts unten
            oval.set(c - d - small, top, c - d + small, top + 2 * small);
            path.arcTo(oval, 270f, 90f - angle, false);
            // Mulde: Kreis um (c, top), von links unten über den Boden nach rechts unten
            oval.set(c - big, top - big, c + big, top + big);
            path.arcTo(oval, 180f - angle, -(180f - 2 * angle), false);
            // rechte abgerundete Kante
            oval.set(c + d - small, top, c + d + small, top + 2 * small);
            path.arcTo(oval, 180f + angle, 90f - angle, false);
        }
        path.lineTo(w + dp(1), top);
        path.lineTo(w + dp(1), h + dp(1));
        path.lineTo(-dp(1), h + dp(1));
        path.close();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        canvas.drawPath(path, fill);
        canvas.drawPath(path, edge);
        super.onDraw(canvas);
    }

    @Override
    public void onViewAdded(android.view.View child) {
        super.onViewAdded(child);
        if (getWidth() > 0) buildPath(getWidth(), getHeight());
    }
}
