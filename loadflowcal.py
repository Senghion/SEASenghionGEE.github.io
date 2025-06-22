import numpy as np
from numpy import cos, sin, pi, abs, angle, real, imag

def lfybus(linedata):
    nl = linedata[:, 0].astype(int) - 1  # from bus
    nr = linedata[:, 1].astype(int) - 1  # to bus
    R = linedata[:, 2]
    X = linedata[:, 3]
    Bc = 1j * linedata[:, 4]
    a = linedata[:, 5]
    
    nbr = len(linedata)
    nbus = max(max(nl), max(nr)) + 1
    
    Z = R + 1j * X
    y = 1 / Z
    
    Ybus = np.zeros((nbus, nbus), dtype=complex)
    
    for k in range(nbr):
        tap = a[k] if a[k] > 0 else 1.0
        Ybus[nl[k], nr[k]] -= y[k] / tap
        Ybus[nr[k], nl[k]] = Ybus[nl[k], nr[k]]
    
    for n in range(nbus):
        for k in range(nbr):
            tap = a[k] if a[k] > 0 else 1.0
            if nl[k] == n:
                Ybus[n, n] += y[k] / (tap ** 2) + Bc[k] / 2
            elif nr[k] == n:
                Ybus[n, n] += y[k] + Bc[k] / 2
    
    return Ybus

def lfnewton(busdata, Ybus, basemva, accuracy=1e-5, maxiter=100):
    nbus = len(busdata)
    bus_type = busdata[:, 1].astype(int)
    Vm = busdata[:, 2].copy()
    Va = np.radians(busdata[:, 3].copy())
    Pd = busdata[:, 4]
    Qd = busdata[:, 5]
    Pg = busdata[:, 6]
    Qg = busdata[:, 7]
    Qmin = busdata[:, 8]
    Qmax = busdata[:, 9]
    Qsh = busdata[:, 10]
    
    V = Vm * (cos(Va) + 1j * sin(Va))
    P = (Pg - Pd) / basemva
    Q = (Qg - Qd + Qsh) / basemva
    
    Ym = abs(Ybus)
    theta = angle(Ybus)
    
    PQ_indices = np.where(bus_type == 0)[0]
    PV_indices = np.where(bus_type == 2)[0]
    
    iter_count = 0
    maxerror = 1
    converge = 1
    
    while maxerror >= accuracy and iter_count < maxiter:
        iter_count += 1
        Pcal = np.zeros(nbus)
        Qcal = np.zeros(nbus)
        
        for i in range(nbus):
            for k in range(nbus):
                Pcal[i] += Vm[i] * Vm[k] * Ym[i, k] * cos(theta[i, k] - Va[i] + Va[k])
                Qcal[i] += -Vm[i] * Vm[k] * Ym[i, k] * sin(theta[i, k] - Va[i] + Va[k])
        
        dP = P - Pcal
        dQ = Q - Qcal
        
        dP = dP[1:]  # Remove swing bus
        dQ = dQ[PQ_indices]
        
        J1 = np.zeros((nbus, nbus))
        J2 = np.zeros((nbus, nbus))
        J3 = np.zeros((nbus, nbus))
        J4 = np.zeros((nbus, nbus))
        
        for i in range(nbus):
            for k in range(nbus):
                if i == k:
                    for m in range(nbus):
                        if m != i:
                            J1[i, k] += Vm[i] * Vm[m] * Ym[i, m] * sin(theta[i, m] - Va[i] + Va[m])
                            J3[i, k] += Vm[i] * Vm[m] * Ym[i, m] * cos(theta[i, m] - Va[i] + Va[m])
                    J2[i, k] = 2 * Vm[i] * Ym[i, i] * cos(theta[i, i])
                    J4[i, k] = -2 * Vm[i] * Ym[i, i] * sin(theta[i, i])
                else:
                    J1[i, k] = -Vm[i] * Vm[k] * Ym[i, k] * sin(theta[i, k] - Va[i] + Va[k])
                    J2[i, k] = Vm[i] * Ym[i, k] * cos(theta[i, k] - Va[i] + Va[k])
                    J3[i, k] = Vm[i] * Vm[k] * Ym[i, k] * cos(theta[i, k] - Va[i] + Va[k])
                    J4[i, k] = Vm[i] * Ym[i, k] * sin(theta[i, k] - Va[i] + Va[k])
        
        J1r = J1[1:, 1:]
        J2r = J2[1:, PQ_indices]
        J3r = J3[PQ_indices, 1:]
        J4r = J4[PQ_indices][:, PQ_indices]
        
        J = np.vstack([
            np.hstack([J1r, J2r]),
            np.hstack([J3r, J4r])
        ])
        
        dPQ = np.concatenate([dP, dQ])
        dX = np.linalg.solve(J, dPQ)
        
        dVa = np.zeros(nbus)
        dVm = np.zeros(nbus)
        
        dVa[1:] = dX[:nbus-1]
        dVm[PQ_indices] = dX[nbus-1:]
        
        Va += dVa
        Vm += dVm
        V = Vm * (cos(Va) + 1j * sin(Va))
        
        maxerror = max(abs(dPQ))
    
    if iter_count >= maxiter:
        print("Warning: Power flow did not converge.")
        converge = 0
    
    return V, converge, iter_count

def lineflow(linedata, V, basemva, P, Q, S):
    nl = linedata[:, 0].astype(int) - 1
    nr = linedata[:, 1].astype(int) - 1
    R = linedata[:, 2]
    X = linedata[:, 3]
    Bc = 1j * linedata[:, 4]
    a = linedata[:, 5]
    
    Z = R + 1j * X
    y = 1 / Z
    SLT = 0 + 0j
        
    line_results = []

    for L in range(len(linedata)):
        tap = a[L] if a[L] > 0 else 1.0
        i = nl[L]
        j = nr[L]
        
        Vi = V[i]
        Vj = V[j]
        
        Iij = (Vi - Vj / tap) * y[L] + Bc[L] / 2 * Vi
        Iji = (Vj - Vi * tap) * y[L] / (tap ** 2) + Bc[L] / 2 * Vj
        
        Sij = Vi * np.conj(Iij) * basemva
        Sji = Vj * np.conj(Iji) * basemva
        loss = Sij + Sji
        SLT += loss
        
        # Collect line flow data for frontend
        line_results.append({
            "line": int(L + 1),  # Line index starting from 1
            "from": int(i + 1),
            "to": int(j + 1),
            "Pij": float(np.real(Sij)),
            "Qij": float(np.imag(Sij)),
            "Sij": float(abs(Sij)),
            "P_loss": float(np.real(loss)),
            "Q_loss": float(np.imag(loss)),
            "tap": float(tap)
        })
    
    SLT /= 2
    return SLT, line_results

def run_loadflow(busdata, linedata):
    basemva = 100
    accuracy = 1e-5
    maxiter = 100
    
    Ybus = lfybus(linedata)
    V, converge, iter_count = lfnewton(busdata, Ybus, basemva, accuracy, maxiter)
    
    
    nbus = len(busdata)
    Vm = abs(V)
    Va = angle(V)
    Pd = busdata[:, 4]
    Qd = busdata[:, 5]
    Pg = busdata[:, 6]
    Qg = busdata[:, 7]
    Qsh = busdata[:, 10]
    
    P = (Pg - Pd)/basemva
    Q = (Qg - Qd + Qsh)/basemva
    S = P + 1j*Q
    
    SLT, line_results = lineflow(linedata, V, basemva, P, Q, S)

    bus_types = {0: 'Load', 1: 'Slack', 2: 'Generator'}
    bus_results = []
    for i in range(nbus):
        btype = bus_types.get(int(busdata[i, 1]), 'Unknown')
        bus_results.append({
            "bus": int(busdata[i, 0]),
            "type": btype,
            "V": float(Vm[i]),
            "angle": float(Va[i]*180/np.pi),
            "Pg": float(Pg[i]),
            "Qg": float(Qg[i]),
            "Pd": float(Pd[i]),
            "Qd": float(Qd[i])
        })

    summary = {
        "converged": f"{'Yes' if converge else 'No'} in {iter_count} iterations",
        "P_loss": float(np.real(SLT)),
        "Q_loss": float(np.imag(SLT))
    }

    return {
        "bus_results": bus_results,
        "line_results": line_results,   # <--- Add this line
        "summary": summary
    }
