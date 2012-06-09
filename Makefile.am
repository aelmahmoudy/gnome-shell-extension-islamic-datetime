SUBDIRS=po

topextensiondir = $(datadir)/gnome-shell/extensions

uuid = islamic-datetime@sabily.org

extensiondir = $(topextensiondir)/$(uuid)

dist_extension_DATA = extension.js stylesheet.css metadata.json convenience.js prefs.js

gsettings_SCHEMAS=schemas/org.gnome.shell.extensions.islamic-datetime.gschema.xml

@GSETTINGS_RULES@

icondir = $(datadir)/icons/hicolor/scalable/apps
icon_DATA = islamic-datetime.svg

zip-file:
	make -C po install itlocaledir=$(CURDIR)/locale
	glib-compile-schemas schemas
	zip -qr islamic-datetime.zip $(dist_extension_DATA) $(icon_DATA) schemas/ locale/ COPYING

clean-local:
	-rm -f schemas/gschemas.compiled islamic-datetime.zip
	-rm -rf locale
