#version 150 core

in vec2 v_TexCoord;
in vec2 v_ScreenPixelCoord;
flat in vec2 v_QuadSizeInPixels;
uniform sampler2D t_Texture;
out vec4 Target0;

uniform Properties {
    vec2 u_WindowSizeInPixels;
};

uniform RendererInput {
    vec2 u_MousePositionInPixels;
};

const float JUST_ABOVE_ZERO = 0.000001;
const float JUST_UNDER_ONE  = 0.999999;

bool is_roughly_integer(float f) {
    f = fract(f);
    return f < JUST_ABOVE_ZERO || f > JUST_UNDER_ONE;
}

bool is_transparent(vec4 colour) {
    return colour.r > JUST_UNDER_ONE;
}

bool is_opaque(vec4 colour) {
    return colour.r < JUST_ABOVE_ZERO;
}

struct Lod {
    float exponent;
    float pixel_size;
};

struct ZoomIn {
    bool transparent;
    bool opaque;
    Lod lod;
};

ZoomIn zoom_in(vec2 px_coord, Lod lod, sampler2D world, vec2 world_size) {
    // zoom into a fully-transparent pixel
    vec2 tex_coord_to_test = px_coord / world_size;
    bool transparent = true;
    while (lod.exponent >= 0) {
        vec4 colour = textureLod(world, tex_coord_to_test, lod.exponent);
        if (is_transparent(colour)) {
            break;
        }
        if (is_opaque(colour)) {
            return ZoomIn(false, true, lod);
        }

        lod.exponent -= 1;
        lod.pixel_size /= 2;
        transparent = false;
    }

    return ZoomIn(transparent, false, lod);
}

struct CrossPixel {
    vec2 px_dest_coord;
    uint edge_axis;
};
const uint EDGE_AXIS_X = 1u;
const uint EDGE_AXIS_Y = 2u;
const uint EDGE_AXIS_BOTH = 3u;

CrossPixel cross_pixel(vec2 px_start_coord, float pixel_size, vec2 px_to_light_unit) {
    vec2 edges_to_check_mult = ceil(px_to_light_unit);
    vec2 px_crossing_edges =
        (floor(px_start_coord / pixel_size) + edges_to_check_mult) * pixel_size;

    if (px_to_light_unit.y == 0) {
        return CrossPixel(
                vec2(px_crossing_edges.x, px_start_coord.y),
                EDGE_AXIS_X);
    } else if (px_to_light_unit.x == 0) {
        return CrossPixel(
                vec2(px_start_coord.x, px_crossing_edges.y),
                EDGE_AXIS_Y);
    } else {
        float px_edge_mult_x = (px_crossing_edges.x - px_start_coord.x) / px_to_light_unit.x;
        float px_edge_mult_y = (px_crossing_edges.y - px_start_coord.y) / px_to_light_unit.y;
        if (px_edge_mult_x < px_edge_mult_y) {
            return CrossPixel(
                    vec2(px_crossing_edges.x, px_edge_mult_x * px_to_light_unit.y),
                    EDGE_AXIS_X);
        } else if (px_edge_mult_y < px_edge_mult_x) {
            return CrossPixel(
                    vec2(px_edge_mult_y * px_to_light_unit.x, px_crossing_edges.y),
                    EDGE_AXIS_Y);

        } else {
            return CrossPixel(px_crossing_edges, EDGE_AXIS_BOTH);
        }
    }
}

const Lod INITIAL_LOD = Lod(6, 64);

Lod zoom_out_single_crossing(float component, Lod lod) {
    while (lod.exponent < INITIAL_LOD.exponent) {
        float pixel_size = lod.pixel_size * 2;
        float f = fract(component / pixel_size);
        if (f > JUST_ABOVE_ZERO && f < JUST_UNDER_ONE) {
            return lod;
        }
        lod.exponent += 1;
        lod.pixel_size = pixel_size;
    }
    return lod;
}

Lod zoom_out_double_crossing(vec2 coord, Lod lod) {
    while (lod.exponent < INITIAL_LOD.exponent) {
        float pixel_size = lod.pixel_size * 2;
        float x = fract(coord.x / pixel_size);
        float y = fract(coord.y / pixel_size);
        if (x > JUST_ABOVE_ZERO && x < JUST_UNDER_ONE) {
            return lod;
        }
        if (y > JUST_ABOVE_ZERO && y < JUST_UNDER_ONE) {
            return lod;
        }
        lod.exponent += 1;
        lod.pixel_size = pixel_size;
    }
    return lod;
}


bool _is_pixel_illuminated(vec2 px_coord_to_test, vec2 px_light_coord, sampler2D world, vec2 world_size) {
    vec2 px_to_light_unit = normalize(px_light_coord - px_coord_to_test);
    vec2 px_to_light_peek = px_to_light_unit / 10;

    Lod lod = Lod(0, 1);
    for (int i = 0; i < 1000; i++) {
        ZoomIn zi = zoom_in(px_coord_to_test, lod, world, world_size);
        if (!zi.transparent) {
            return false;
        }

        lod = zi.lod;

        CrossPixel cp = cross_pixel(px_coord_to_test, lod.pixel_size, px_to_light_unit);

     //   vec2 cur_to_dest = cp.px_dest_coord - px_coord_to_test;
     //   vec2 cur_to_light = px_light_coord - px_coord_to_test;
     //   if (dot(cur_to_light, cur_to_light) <= dot(cur_to_dest, cur_to_dest)) {
     //       return true;
     //   }

//        if (!is_transparent(textureLod(world, px_coord_to_test / world_size, 0))) {
//            return false;
//        }

     //  px_coord_to_test += px_to_light_unit;
        px_coord_to_test = cp.px_dest_coord;
       if (distance(px_coord_to_test, px_light_coord) < 100) {
           return true;
       }


        /*
        if (cp.edge_axis == EDGE_AXIS_X) {
            lod = zoom_out_single_crossing(px_coord_to_test.x, lod);
        } else if (cp.edge_axis == EDGE_AXIS_Y) {
            lod = zoom_out_single_crossing(px_coord_to_test.y, lod);
        } else {
            lod = zoom_out_double_crossing(px_coord_to_test, lod);
        }*/
    }

    return false;
}

bool is_pixel_illuminated(
        vec2 px_start_coord,
        vec2 px_light_coord,
        sampler2D world,
        vec2 world_size,
        const Lod max_lod) {

    float px_start_to_light_distance = distance(px_start_coord, px_light_coord);
    vec2 px_coord = px_start_coord;
    vec2 px_to_light = px_light_coord - px_coord;
    Lod lod = max_lod;

    for (int i = 0; i < 255; i++) {
        vec2 scaled_coord = px_coord / lod.pixel_size;
        vec2 scaled_far_corner = vec2(0, 0);
        if (px_light_coord.x > px_start_coord.x) {
            scaled_far_corner.x = floor(scaled_coord.x + 1);
        } else {
            scaled_far_corner.x = ceil(scaled_coord.x - 1);
        }
        if (px_light_coord.y > px_start_coord.y) {
            scaled_far_corner.y = floor(scaled_coord.y + 1);
        } else {
            scaled_far_corner.y = ceil(scaled_coord.y - 1);
        }
        vec2 px_far_corner = scaled_far_corner * lod.pixel_size;


        uint edge_axis = 0u;
        vec2 px_next_coord = px_coord;
        if (px_to_light.x == 0) {
            px_next_coord.y = px_far_corner.y;
            edge_axis = EDGE_AXIS_Y;
        } else if (px_to_light.y == 0) {
            px_next_coord.x = px_far_corner.x;
            edge_axis = EDGE_AXIS_X;
        } else {
            vec2 edge_mult = (px_far_corner - px_coord) / px_to_light;
            if (edge_mult.x < edge_mult.y) {
                px_next_coord = vec2(px_far_corner.x, px_coord.y + edge_mult.x * px_to_light.y);
                edge_axis = EDGE_AXIS_X;
            } else if (edge_mult.y < edge_mult.x) {
                px_next_coord = vec2(px_coord.x + edge_mult.y * px_to_light.x, px_far_corner.y);
                edge_axis = EDGE_AXIS_Y;
            } else {
                px_next_coord = px_far_corner;
                edge_axis = EDGE_AXIS_BOTH;
            }
        }

        vec2 px_sample_coord = (px_coord + px_next_coord) / 2;
        vec4 sample_colour = textureLod(world, px_sample_coord / world_size, lod.exponent);

        if (is_opaque(sample_colour)) {
//            Target0 = vec4(0.5,0.5,1,1) * textureLod(t_Texture, v_TexCoord, 0);
            return false;
        } else if (is_transparent(sample_colour)) {
            if (distance(px_start_coord, px_next_coord) > px_start_to_light_distance) {
//                Target0 = vec4(0,lod.exponent / 7,0,1) * texture(t_Texture, v_TexCoord);
    //            Target0 = vec4(0,float(i)/255.0,0,1) * texture(t_Texture, v_TexCoord);
                return true;
            } else {
                px_coord = px_next_coord;
                if (edge_axis == EDGE_AXIS_BOTH) {
                    while (lod.exponent < max_lod.exponent) {
                        float next_pixel_size = lod.pixel_size * 2;
                        if (is_roughly_integer(px_coord.x / next_pixel_size) &&
                                is_roughly_integer(px_coord.y / next_pixel_size)) {
                            lod.exponent += 1;
                            lod.pixel_size = next_pixel_size;
                        } else {
                            break;
                        }
                    }
                } else {
                    float axis = 0;
                    if (edge_axis == EDGE_AXIS_X) {
                        axis = px_coord.x;
                    } else {
                        axis = px_coord.y;
                    }
                    while (lod.exponent < max_lod.exponent) {
                        float next_pixel_size = lod.pixel_size * 2;
                        if (is_roughly_integer(axis / next_pixel_size)) {
                            lod.exponent += 1;
                            lod.pixel_size = next_pixel_size;
                        } else {
                            break;
                        }
                    }
                }
            }
        } else {
            lod.exponent -= 1;
            lod.pixel_size /= 2;
        }



        /*
        vec4 sampled_colour = textureLod(world, px_sample_coord / world_size, lod.exponent);
        if (!is_transparent(sampled_colour)) {
            return false;
        }
        */



    }

//    Target0 = vec4(1,0.5,0.5,1) * texture(t_Texture, v_TexCoord);
    return false;
}

void main() {
    if (is_pixel_illuminated(
                v_ScreenPixelCoord,
                u_MousePositionInPixels,
                t_Texture,
                v_QuadSizeInPixels,
                INITIAL_LOD)) {
        Target0 = texture(t_Texture, v_TexCoord);
    } else {
        Target0 = texture(t_Texture, v_TexCoord) / 3;
    }
}

