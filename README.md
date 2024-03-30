# every datapoint is a soul

A windows 4k intro by chlumpie / rebels & pestis / brainlez Coders!, released at
Revision 2024.

Source: https://github.com/vsariola/every-datapoint

Capture: https://www.youtube.com/watch?v=zUUtE7zUtCE

More info in the distribution [.NFO file](dist/every-datapoint-is-a-soul.nfo)

## Prerequisites for building

Rocket is included as a submodule in the repo, so you should clone it
with e.g.
`git clone --depth=1 --recursive https://github.com/vsariola/every-datapoint`

Following tools should be in path:

1. [nasm](https://www.nasm.us/)
2. [Python 3](https://www.python.org/)
3. [Shader-minifier](https://github.com/laurentlb/Shader_Minifier)
4. [Crinkler](https://github.com/runestubbe/Crinkler) Note: As crinkler.exe, not link.exe
5. Optionally: [glslangValidator](https://github.com/KhronosGroup/glslang)

So far, building has been tested with Visual Studio 2022. Make sure you
also installed [CMake](https://cmake.org/) with it as the build was
automated with CMake.

## Build

1. Open the repository folder using Visual Studio
2. Choose the configuration (heavy-1080 is the compo version).
   Light/medium/heavy refers to compression level, 720/1080/2160 the
   resolution. Debug versions are for development.
3. Build & run.

CMake should copy the exes into the dist/ folder.

## How to sync

Choose the sync-1080 configuration, which has SYNC macro defined. Build
it and then:

1. Run this rocket server: https://github.com/emoon/rocket
2. Then run the sync build intro. Note that if you try to sync.exe
   before running the server, it just closes. So the server needs to be
   ran first.
3. With the server, open the data/syncs.rocket and start syncing. Then
   save your changes back to the XML.

If you need more sync tracks, just manually add a new empty track to the
syncs.rocket XML before building the `sync` target
(`<track name="mygroup#mytrackname"/>`). When building intro, the file
will get processed and the executable will become aware of the sync
variable. The new track will appear as a const variable in the shader.
For a track named `mygroup#mytrackname`, a constant
`MYGROUP_MYTRACKNAME` will be available to the shader, and you can
access the variable with `syncs[MYGROUP_MYTRACKNAME]`. The `#` grouping
character is replaced with `_` and the string is made uppercase.

Notice that when building the final intro, the sync key values are
stored as signed 8.7 fixed point, and as an optimization, all other
interpolation modes than step and linear were removed from the player.
Thus, never use values outside the range -128 <= x < 128, and never use
ramp & smooth interpolation modes.

## License

[MIT](LICENSE)