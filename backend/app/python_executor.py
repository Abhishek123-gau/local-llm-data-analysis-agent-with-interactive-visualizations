import io
import base64
import sys
import contextlib
import traceback
from typing import Dict, Any, Optional
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server
import matplotlib.pyplot as plt
import seaborn as sns

class PythonPlotExecutor:
    """Safely executes Python data visualization code using Matplotlib & Seaborn on the active dataset."""

    @staticmethod
    def setup_dark_theme():
        """Applies a clean modern dark theme matching the IDE and UI."""
        plt.style.use('dark_background')
        sns.set_theme(
            style="darkgrid",
            rc={
                "figure.facecolor": "#0F172A",  # Slate 900
                "axes.facecolor": "#1E293B",    # Slate 800
                "grid.color": "#334155",        # Slate 700
                "text.color": "#F8FAFC",        # Slate 50
                "axes.labelcolor": "#CBD5E1",   # Slate 300
                "xtick.color": "#94A3B8",       # Slate 400
                "ytick.color": "#94A3B8",       # Slate 400
                "figure.autolayout": True,
                "font.sans-serif": ["Segoe UI", "DejaVu Sans", "Helvetica", "Arial"],
            }
        )

    @staticmethod
    def execute_plot(code: str, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Executes plotting code with `df` preloaded.
        Returns base64 PNG string, stdout output, and any error message.
        """
        PythonPlotExecutor.setup_dark_theme()
        plt.close('all')  # Clear any prior open figures

        # Prepare execution sandbox
        stdout_capture = io.StringIO()
        local_scope = {
            "df": df.copy(),
            "pd": pd,
            "np": np,
            "plt": plt,
            "sns": sns,
        }

        # Auto-import scipy if available
        try:
            import scipy
            local_scope["scipy"] = scipy
            import scipy.stats as stats
            local_scope["stats"] = stats
        except ImportError:
            pass

        try:
            with contextlib.redirect_stdout(stdout_capture):
                exec(code, local_scope)

            # Check if a figure exists
            fig = plt.gcf()
            if fig and fig.get_axes():
                # Save plot to base64 buffer
                buf = io.BytesIO()
                plt.savefig(buf, format="png", dpi=160, bbox_inches="tight", facecolor=fig.get_facecolor())
                buf.seek(0)
                img_base64 = base64.b64encode(buf.read()).decode("utf-8")
                plt.close('all')

                return {
                    "success": True,
                    "image_base64": f"data:image/png;base64,{img_base64}",
                    "stdout": stdout_capture.getvalue().strip(),
                    "error": None,
                }
            else:
                plt.close('all')
                return {
                    "success": False,
                    "image_base64": None,
                    "stdout": stdout_capture.getvalue().strip(),
                    "error": "The code executed but did not generate a Matplotlib/Seaborn figure.",
                }

        except Exception as e:
            plt.close('all')
            err_msg = traceback.format_exc()
            return {
                "success": False,
                "image_base64": None,
                "stdout": stdout_capture.getvalue().strip(),
                "error": f"Plot execution error: {str(e)}\n{err_msg}",
            }

python_executor = PythonPlotExecutor()
