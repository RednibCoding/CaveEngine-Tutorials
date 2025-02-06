// Shader "Default/Renderer/Vertex.glsl"
#include "Default/Header.glsl"

// Mesh Data inputs:
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aTexCoord;
layout(location = 2) in vec3 aNormal;
layout(location = 3) in vec3 aTangent;
layout(location = 4) in vec4 aBoneWeights;
layout(location = 5) in vec4 aBoneIDs;

// Vertex Shader Outputs:
out VS_OUT {
    vec3 normal;
    vec3 tangent;
    vec2 texCoord;
    vec3 position;
} vsOut;

out vec4 entityTint;
flat out ivec4 entityID;

//---------------------------------------------------------------------------//
// Controls how fast the leaves shake
uniform float leafShakeSpeed = 2.0;
// Controls how much the leaves shake
uniform float leafShakeStrength = 3.0;

//---------------------------------------------------------------------------//

// Uniforms:
#include "Default/Uniforms/Armature.glsl"

uniform mat4 _model;
uniform mat4 _viewProjection; // Camera

struct Instance {
    mat4 model;
    vec4 tint;
    ivec4 id;
};

uniform bool _useInstances;
uniform Instance _instances[100];

uniform float _timer;         // Timer for animation
uniform vec4 _tint;
uniform ivec4 _id;

//---------------------------------------------------------------------------//

// Function to generate a random value per leaf
float leafRandom(vec3 input) {
    return fract(sin(dot(input, vec3(12.9898, 78.233, 45.164))) * 43758.5453) * 10.0;
}

void main() {
    vec3 vertexPos = aPos;
    vec3 normalVec = aNormal;
    vec3 tangentVec = aTangent;

    // Apply armature transformations if enabled
    if (_useArmature) {
        mat4 armatureMat = GetArmatureMatrix();
        vertexPos = (armatureMat * vec4(vertexPos, 1.0)).xyz;
        normalVec = (armatureMat * vec4(normalVec, 0.0)).xyz;
        tangentVec = (armatureMat * vec4(tangentVec, 0.0)).xyz;
    }

    mat4 meshModel;

    if (_useInstances) {
        meshModel  = _instances[gl_InstanceID].model;
        entityTint = _instances[gl_InstanceID].tint;
        entityID = _instances[gl_InstanceID].id;
    } else {
        meshModel  = _model;
        entityTint = _tint;
        entityID = _id;
    }

    //---------------------------------------------------------------------------//
    // --- Only Leaves Shake ---
    float time = _timer * clamp(leafShakeSpeed, 0.0, 20.0);
    
    // Generate randomized leaf movement (so leaves don't move the same)
    float leafFactor = leafRandom(vertexPos);

    // Subtle independent leaf shaking
    float shakeStrength = clamp(leafShakeStrength/20, 0.0, 0.4);
    float shakeX = sin(time + leafFactor) * shakeStrength;
    float shakeY = cos(time * 0.5 + leafFactor) * shakeStrength;

    // Apply shaking
    vertexPos.x += shakeX;
    vertexPos.y += shakeY * 0.3; // Weaker vertical movement
    //---------------------------------------------------------------------------//

    // Final position transformation
    gl_Position = _viewProjection * meshModel * vec4(vertexPos, 1.0);
    vsOut.position = (meshModel * vec4(vertexPos, 1.0)).xyz;

    // Pass-through attributes
    vsOut.texCoord = aTexCoord;
    vsOut.normal   = normalize((meshModel * vec4(normalVec, 0.0)).xyz);
    vsOut.tangent  = normalize((meshModel * vec4(tangentVec, 0.0)).xyz);
}
