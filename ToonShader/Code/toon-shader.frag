#include "Default/Header.glsl"

#include "Math/Random.glsl"
#include "Math/Perlin.glsl"
#include "Math/Fxaa.glsl"  // Provide Fxaa function

in VS_OUT {
    vec2 texCoord;  // The UVs for sampling
} fsIn;

layout(location = 0) out vec4 gColor;  // Final color


uniform sampler2D inColor;
uniform sampler2D inNormal;
uniform sampler2D inAssetID;

uniform float _camNear;
uniform float _camFar;

// ---------------------------------------------------------------------
// Toon & Outline Parameters
// ---------------------------------------------------------------------

uniform float shadingSteps = 7.3;
const float lineThickness = 2.0;
const float outlineThreshold = 0.2;
const float normalFadeStart = 10.0;
const float normalFadeEnd = 30.0;
const float depthFadeStart = 25.0;
const float depthFadeEnd = 40.0;

// ---------------------------------------------------------------------
// Small 3x3 box-blur for the normal map
//  (helps reduce flicker from high-frequency normal noise)
// ---------------------------------------------------------------------
vec3 sampleNormal(sampler2D tex, vec2 uv)
{
    // Convert [0..1] to [-1..1]
    vec3 n = texture(tex, uv).rgb * 2.0 - 1.0;
    return normalize(n);
}

float sampleDepth(sampler2D tex, vec2 uv)
{
    // Depth is stored in .a (alpha)
    return texture(tex, uv).a;
}

vec3 blurNormal(sampler2D tex, vec2 uv, vec2 texelSize)
{
    // A simple 3x3 box blur. For better quality
    vec3 sum = vec3(0.0);
    for (int j = -1; j <= 1; j++)
    {
        for (int i = -1; i <= 1; i++)
        {
            vec2 offset = vec2(float(i), float(j)) * texelSize;
            sum += sampleNormal(tex, uv + offset);
        }
    }
    // Normalize the average so it’s still unit-length
    return normalize(sum / 9.0);
}

// ---------------------------------------------------------------------
// Sobel for Normal Edges (dot-product approach)
// ---------------------------------------------------------------------
float getNormalEdgeSobel(sampler2D normalTex, vec2 uv, vec2 tsize)
{
    // We'll measure how dot(nCenter, nNeighbor) changes in x and y directions.
    // Center
    vec3 nC = sampleNormal(normalTex, uv);

    // For a full sobel, we sample at offsets:
    //   -1,-1  0,-1  +1,-1
    //   -1, 0   0,0  +1, 0
    //   -1,+1  0,+1  +1,+1
    float dN  = 1.0 - dot(nC, sampleNormal(normalTex, uv + vec2(0.0,      -tsize.y)));
    float dS  = 1.0 - dot(nC, sampleNormal(normalTex, uv + vec2(0.0,       tsize.y)));
    float dE  = 1.0 - dot(nC, sampleNormal(normalTex, uv + vec2( tsize.x,  0.0     )));
    float dW  = 1.0 - dot(nC, sampleNormal(normalTex, uv + vec2(-tsize.x,  0.0     )));
    float dNE = 1.0 - dot(nC, sampleNormal(normalTex, uv + vec2( tsize.x, -tsize.y)));
    float dNW = 1.0 - dot(nC, sampleNormal(normalTex, uv + vec2(-tsize.x, -tsize.y)));
    float dSE = 1.0 - dot(nC, sampleNormal(normalTex, uv + vec2( tsize.x,  tsize.y)));
    float dSW = 1.0 - dot(nC, sampleNormal(normalTex, uv + vec2(-tsize.x,  tsize.y)));

    float gx = (dNW + 2.0 * dW + dSW) - (dNE + 2.0 * dE + dSE);
    float gy = (dNW + 2.0 * dN + dNE) - (dSW + 2.0 * dS + dSE);

    // Sobel magnitude
    return sqrt(gx * gx + gy * gy);
}

// ---------------------------------------------------------------------
// Sobel for Depth Edges
// ---------------------------------------------------------------------
float getDepthEdgeSobel(sampler2D normalTex, vec2 uv, vec2 tsize)
{
    // Use absolute difference from center
    float dC  = sampleDepth(normalTex, uv);

    float dN  = sampleDepth(normalTex, uv + vec2(0.0,      -tsize.y));
    float dS  = sampleDepth(normalTex, uv + vec2(0.0,       tsize.y));
    float dE  = sampleDepth(normalTex, uv + vec2( tsize.x,  0.0     ));
    float dW  = sampleDepth(normalTex, uv + vec2(-tsize.x,  0.0     ));
    float dNE = sampleDepth(normalTex, uv + vec2( tsize.x, -tsize.y));
    float dNW = sampleDepth(normalTex, uv + vec2(-tsize.x, -tsize.y));
    float dSE = sampleDepth(normalTex, uv + vec2( tsize.x,  tsize.y));
    float dSW = sampleDepth(normalTex, uv + vec2(-tsize.x,  tsize.y));

    float nN  = abs(dC - dN);
    float nS  = abs(dC - dS);
    float nE  = abs(dC - dE);
    float nW  = abs(dC - dW);
    float nNE = abs(dC - dNE);
    float nNW = abs(dC - dNW);
    float nSE = abs(dC - dSE);
    float nSW = abs(dC - dSW);

    float gx = (nNW + 2.0 * nW + nSW) - (nNE + 2.0 * nE + nSE);
    float gy = (nNW + 2.0 * nN + nNE) - (nSW + 2.0 * nS + nSE);

    return sqrt(gx * gx + gy * gy);
}

// ---------------------------------------------------------------------
// Main Fragment
// ---------------------------------------------------------------------
void main()
{
    // -------------------------------------------------------------
    // 1) Get base color
    // -------------------------------------------------------------
    vec3 baseColor = texture(inColor, fsIn.texCoord).rgb;

    // -------------------------------------------------------------
    // 2) Basic Toon Shading: quantize brightness
    // -------------------------------------------------------------
    float brightness = dot(baseColor, vec3(0.299, 0.587, 0.114));
    brightness = floor(brightness * shadingSteps) / shadingSteps;
    // Re-scale color so we keep hue
    // (avoid overly darkening everything if brightness is small)
    baseColor *= brightness / max(dot(baseColor, vec3(0.333)), 0.001);

    // -------------------------------------------------------------
    // 3) Compute a blurred version of the normal at this fragment
    //    to reduce flicker from high-frequency normal changes
    // -------------------------------------------------------------
    vec2 texRes     = textureSize(inNormal, 0);
    vec2 texelSize  = 1.0 / texRes;

    // We'll do a small 3x3 blur on the normal at fsIn.texCoord
    vec3 blurredNormal = blurNormal(inNormal, fsIn.texCoord, texelSize);

    // -------------------------------------------------------------
    // 4) Do Sobel on blurred normal & on depth, separately
    // -------------------------------------------------------------

    // center depth
    float depthVal = sampleDepth(inNormal, fsIn.texCoord);

    float normalEdge = getNormalEdgeSobel(inNormal, fsIn.texCoord, texelSize);

    float depthEdge  = getDepthEdgeSobel(inNormal, fsIn.texCoord, texelSize);

    // -------------------------------------------------------------
    // 5) Fade outlines by distance
    //    - "Normal" outlines fade out at [normalFadeStart .. normalFadeEnd]
    //    - "Silhouette" outlines fade out at [depthFadeStart .. depthFadeEnd]
    // -------------------------------------------------------------
    float normalFadeFactor     = 1.0 - smoothstep(normalFadeStart, normalFadeEnd, depthVal);
    float silhouetteFadeFactor = 1.0 - smoothstep(depthFadeStart, depthFadeEnd, depthVal);

    normalEdge *= normalFadeFactor;
    depthEdge  *= silhouetteFadeFactor;

    // Combine the edges
    float combinedEdge = max(normalEdge, depthEdge);

    // -------------------------------------------------------------
    // 6) Scale by "line thickness" uniform
    //    (Higher => easier to exceed threshold => thicker lines)
    // -------------------------------------------------------------
    float scaledEdge = combinedEdge * lineThickness;

    // -------------------------------------------------------------
    // 7) Apply a soft threshold using smoothstep
    //    This helps reduce flicker vs. a hard cutoff
    // -------------------------------------------------------------
    float edgeMask = smoothstep(outlineThreshold, outlineThreshold * 2.0, scaledEdge);

    // -------------------------------------------------------------
    // 8) Darken outlines (pure black)
    // -------------------------------------------------------------
    vec3 outlineColor = vec3(0.0);
    vec3 toonColor    = mix(baseColor, outlineColor, edgeMask);

    // -------------------------------------------------------------
    // 9) final FXAA pass
    vec2 screenPos = fsIn.texCoord * texRes; // FXAA wants pixel coords
    vec3 fxaaColor = Fxaa(inColor, screenPos, texRes).rgb;

    // Quick blend: 60% toon color, 40% FXAA color
    vec3 finalColor = mix(toonColor, fxaaColor, 0.4);

    // Output
    gColor = vec4(finalColor, 1.0);
}
