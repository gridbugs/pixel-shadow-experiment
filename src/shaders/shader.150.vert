#version 150 core

in vec2 a_CornerZeroToOne;
in vec2 i_PositionWithinWindowInPixels;
in vec2 i_SizeInPixels;

uniform Properties {
    vec2 u_WindowSizeInPixels;
};

out vec2 v_TexCoord;
out vec2 v_ScreenPixelCoord;
flat out vec2 v_QuadSizeInPixels;

void main() {

    vec2 pixel_offset = a_CornerZeroToOne * i_SizeInPixels;
    vec2 pixel_coord = i_PositionWithinWindowInPixels + pixel_offset;

    vec2 screen_coord = vec2(
        pixel_coord.x / u_WindowSizeInPixels.x * 2 - 1,
        1 - pixel_coord.y / u_WindowSizeInPixels.y * 2);

    v_TexCoord = a_CornerZeroToOne;
    v_ScreenPixelCoord = pixel_coord;
    v_QuadSizeInPixels = i_SizeInPixels;

    gl_Position = vec4(screen_coord, 0, 1);
}

