// Shader "Filters/Dither.glsl"
#include "Default/Header.glsl"

#include "Math/Random.glsl"

in VS_OUT {
    vec2 texCoord;
} fsIn;

layout(location = 0) out vec4 gColor;

uniform sampler2D inColor;

const mat4 DITH = mat4(
    -4.0,  0.0, -3.0,  1.0,
     2.0, -2.0,  3.0, -1.0,
    -3.0,  1.0, -4.0,  0.0,
     3.0, -1.0,  2.0, -2.0
);

const float DITHER_STRENGTH = 0.015;
const float COLOR_FACTOR = 8.0;
const float DITHER_SCALE = 1.0;

void main() {
    vec3 color = texture(inColor, fsIn.texCoord).rgb;


    // Calculate dithering pattern
    vec2 ditherUV = fsIn.texCoord * DITHER_SCALE;
    ditherUV = floor(ditherUV + 0.001);

    float ditherValue = DITH[int(mod(ditherUV.x, 4.0))][int(mod(ditherUV.y, 4.0))] * DITHER_STRENGTH;
    color += ditherValue;
    
    // Quantize colors
    color = floor(color * COLOR_FACTOR) / COLOR_FACTOR;
    gColor = vec4(color, 1.0);
}
