#                                               -*- Autoconf -*-
# Process this file with autoconf to produce a configure script.
AC_PREREQ([2.68])
AC_INIT([gnome-shell-extension-islamic-datetime], 1.0, [BUG-REPORT-ADDRESS])
AM_INIT_AUTOMAKE

GETTEXT_PACKAGE=islamic-datetime
AC_SUBST(GETTEXT_PACKAGE)
AC_DEFINE_UNQUOTED(GETTEXT_PACKAGE, "$GETTEXT_PACKAGE",
                   [The prefix for our gettext translation domains.])
IT_PROG_INTLTOOL(0.26)


PKG_PROG_PKG_CONFIG([0.22])
GLIB_GSETTINGS

# Checks for header files.

# Checks for typedefs, structures, and compiler characteristics.

# Checks for library functions.

AC_CONFIG_FILES([Makefile po/Makefile.in])
AC_OUTPUT
