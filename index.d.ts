declare interface Display {
	id: string;
	name: string;
}

declare interface Options {
	/**
	Optional. Absolute or relative path to save output.

	@default ""
	*/
	filename?: string;

	/**

	@default ""
	*/
	format?: "png" | "jpg";

	/**
	linuxLibrary. Which library to use. Note that scrot does not support format or screen selection.

	Linux only

	*/
	linuxLibrary?: "scrot" | "imagemagick";

}


declare namespace screenshot {
	/**

	@returns An array of Display.
	*/
	function listDisplays(): Promise<Display[]>;

	/**

	@returns An array of Buffers, one for each screen.
	*/
	function all(): Promise<Buffer[]>;
}

/**
Screenshot-desktop capture function

@returns The output file location.
*/
declare function screenshot(options?: Options): Promise<string>;

export = screenshot;
