// Shader "Filters/Pixelation.glsl"
#include "Default/Header.glsl"

// Includes useful math functions
#include "Math/Random.glsl"
#include "Math/Perlin.glsl"

in VS_OUT{
    vec2 texCoord;
} fsIn;

layout(location = 0) out vec4 gColor;

uniform sampler2D inColor;
uniform sampler2D inNormal;
uniform sampler2D inAssetID;

uniform mat4  _camView;
uniform mat4  _camProj;
uniform float _camNear;
uniform float _camFar;

// Size of pixels (higher = blockier)
uniform float pixelSize = 4.0;

// Pixelation Function
vec2 pixelateScreenUV(vec2 uv, vec2 resolution, float pixelSize) {
    return floor(uv * resolution / pixelSize) * (pixelSize / resolution);
}

void main() {
    // Get screen resolution
    vec2 resolution = textureSize(inColor, 0);

    // Apply Pixelation
    vec2 pixelatedUV = pixelateScreenUV(fsIn.texCoord, resolution, pixelSize);
    vec4 color = texture(inColor, pixelatedUV);

    // Final Output
    gColor = color;
}