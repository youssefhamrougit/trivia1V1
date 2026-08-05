# ============================================================================
#  Makefile — build the C++ backend (MSYS2 / MinGW g++ on Windows)
#
#    cd backend
#    make
#    ./app.exe
#
#  Needs: g++ (from MSYS2/MinGW-w64), OpenSSL dev libraries
#         (pacman -S mingw-w64-x86_64-openssl) and Windows sockets.
# ============================================================================

CXX     = g++
CXXFLAGS = -std=c++17 -O2 -Wall -Wextra
LDFLAGS  = -lssl -lcrypto -lws2_32

all: app.exe

app.exe: main.cpp app.cpp app.hpp http.hpp json.hpp supabase.hpp
	$(CXX) $(CXXFLAGS) main.cpp app.cpp $(LDFLAGS) -o app.exe
	@echo ""
	@echo "Built! Run it from the project root:  ../app.exe  (or copy it: ./app.exe)"

run: app.exe
	./app.exe

clean:
	rm -f app.exe *.o

.PHONY: all run clean
