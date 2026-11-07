#pragma once
#include <cmath>
#include <cstdio>
#include <functional>
#include <string>
#include <vector>

namespace BRTest
{
	struct Case { const char* Name; std::function<void()> Fn; };
	inline std::vector<Case>& Registry() { static std::vector<Case> R; return R; }
	inline int& Failures() { static int F = 0; return F; }
	inline int& Checks() { static int C = 0; return C; }
	struct Registrar { Registrar(const char* N, std::function<void()> F) { Registry().push_back({ N, F }); } };
}

#define BR_TEST(Name) static void Name(); static BRTest::Registrar Name##_reg(#Name, Name); static void Name()
#define BR_CHECK(Cond) do { ++BRTest::Checks(); if (!(Cond)) { ++BRTest::Failures(); std::printf("  FAIL %s:%d: %s\n", __FILE__, __LINE__, #Cond); } } while (0)
#define BR_NEAR(A, B, Eps) do { ++BRTest::Checks(); const double _a = (A), _b = (B); if (std::fabs(_a - _b) > (Eps)) { ++BRTest::Failures(); std::printf("  FAIL %s:%d: %s = %f, expected %f\n", __FILE__, __LINE__, #A, _a, _b); } } while (0)
