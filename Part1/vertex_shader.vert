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

// -- Wave effect --
const float waveStrength = 0.1;
const float waveFrequency = 2.0;
const float waveSpeed = 2.0;
const vec2 waveDirection = vec2(1.0, 0.5);

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

    // Instance-based or single model logic
    if (_useInstances) {
        meshModel  = _instances[gl_InstanceID].model;
        entityTint = _instances[gl_InstanceID].tint;
        entityID = _instances[gl_InstanceID].id;
    } else {
        meshModel  = _model;
        entityTint = _tint;
        entityID = _id;
    }

    // Wave displacement effect
    float time = _timer * waveSpeed;
    float wave = sin(dot(aPos.xz, waveDirection) * waveFrequency + time) * waveStrength;
    vertexPos.y += wave;

    // Final position
    gl_Position = _viewProjection * meshModel * vec4(vertexPos, 1.0);
    vsOut.position = (meshModel * vec4(vertexPos, 1.0)).xyz;

    // Pass-through attributes
    vsOut.texCoord = aTexCoord;
    vsOut.normal   = normalize((meshModel * vec4(normalVec, 0.0)).xyz);
    vsOut.tangent  = normalize((meshModel * vec4(tangentVec, 0.0)).xyz);
}